/**
 * Opt-in CPU profiler. A V8 sampling profile runs for a short window every interval; the functions that used the most CPU in
 * the window are sent as `profile.cpu` spans (`profiling.type=cpu`, `code.function`, `profiling.samples`), which the Owlpane
 * Profiler page turns into a flame view. It uses its own always-on tracer so trace sampling never drops a profile.
 *
 * Turn on with `owlpane.start({ profiling: true })` or OWLPANE_PROFILING=1. CPU only; no heap or allocation profile.
 */
import { Session } from "node:inspector";
import { api, resources, tracing } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

export type CallFrame = { functionName: string; url: string; lineNumber: number };
export type CpuProfile = {
  nodes: Array<{ id: number; callFrame: CallFrame }>;
  samples?: number[];
  timeDeltas?: number[];
};

export type HotFunction = { function: string; file: string; line: number; samples: number; selfMs: number };

/** V8 bookkeeping nodes that say nothing about the application. */
const SKIP = new Set(["(root)", "(program)", "(idle)"]);

/**
 * The functions that used the most CPU in a profile, by self time. A sample's duration is the gap to the next sample (what
 * Chrome DevTools uses); the last sample gets `samplingIntervalUs`. Ties break on name so the result is stable.
 */
export function hotFunctions(profile: CpuProfile, samplingIntervalUs: number, top = 20): HotFunction[] {
  const byId = new Map(profile.nodes.map((n) => [n.id, n.callFrame]));
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  const acc = new Map<string, HotFunction & { us: number }>();
  for (let i = 0; i < samples.length; i++) {
    const frame = byId.get(samples[i]);
    if (!frame || SKIP.has(frame.functionName)) continue;
    const name = frame.functionName || "(anonymous)";
    const key = `${name}|${frame.url}|${frame.lineNumber}`;
    const us = deltas[i + 1] ?? samplingIntervalUs;
    const cur = acc.get(key) ?? { function: name, file: frame.url, line: frame.lineNumber + 1, samples: 0, selfMs: 0, us: 0 };
    cur.samples += 1;
    cur.us += us;
    acc.set(key, cur);
  }
  return [...acc.values()]
    .map(({ us, ...f }) => ({ ...f, selfMs: Math.round(us) / 1000 }))
    .sort((a, b) => b.samples - a.samples || b.selfMs - a.selfMs || a.function.localeCompare(b.function))
    .slice(0, top);
}

export type ProfilerOptions = {
  endpoint: string;
  headers?: Record<string, string>;
  resource: ReturnType<typeof resources.resourceFromAttributes>;
  /** How long each profile runs. Default 10 s. */
  windowMs?: number;
  /** Time between the starts of two windows. Default 60 s. */
  everyMs?: number;
  /** V8 sampling interval in microseconds. Default 10000 (10 ms). */
  samplingIntervalUs?: number;
};

export type ProfilerHandle = { stop(): Promise<void> };

function post<T>(session: Session, method: string, params?: object): Promise<T> {
  return new Promise((resolve, reject) => session.post(method, params, (err, result) => (err ? reject(err) : resolve(result as T))));
}

export function startProfiler(o: ProfilerOptions): ProfilerHandle {
  const windowMs = Math.max(1000, o.windowMs ?? 10_000);
  const everyMs = Math.max(windowMs, o.everyMs ?? 60_000);
  const intervalUs = Math.max(100, o.samplingIntervalUs ?? 10_000);
  const provider = new tracing.BasicTracerProvider({
    resource: o.resource,
    spanProcessors: [new tracing.BatchSpanProcessor(new OTLPTraceExporter({ url: `${o.endpoint.replace(/\/+$/, "")}/v1/traces`, headers: o.headers }))],
  });
  const tracer = provider.getTracer("owlpane-profiler");
  const session = new Session();
  session.connect();
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  let endWindowNow: (() => void) | undefined;
  let current: Promise<void> = Promise.resolve();

  const runWindow = async () => {
    try {
      await post(session, "Profiler.enable");
      await post(session, "Profiler.setSamplingInterval", { interval: intervalUs });
      await post(session, "Profiler.start");
      // stop() ends the window early, so the profile taken so far is still sent.
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, windowMs);
        endWindowNow = () => (clearTimeout(t), resolve());
      });
      endWindowNow = undefined;
      const { profile } = await post<{ profile: CpuProfile }>(session, "Profiler.stop");
      const end = Date.now();
      for (const f of hotFunctions(profile, intervalUs)) {
        const span = tracer.startSpan("profile.cpu", {
          root: true,
          kind: api.SpanKind.INTERNAL,
          startTime: end - windowMs,
          attributes: {
            "profiling.type": "cpu",
            "profiling.function": f.function,
            "code.function": f.function,
            "code.filepath": f.file,
            "code.lineno": f.line,
            "profiling.samples": f.samples,
            "profiling.self_ms": f.selfMs,
            "profiling.window_ms": windowMs,
          },
        });
        span.end(end);
      }
    } catch {
      // Profiling is best-effort and must never affect the application.
    }
  };

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      current = runWindow().then(schedule);
    }, everyMs - windowMs);
    timer.unref();
  };
  current = runWindow().then(schedule);

  return {
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      endWindowNow?.();
      await current;
      session.disconnect();
      await provider.shutdown();
    },
  };
}
