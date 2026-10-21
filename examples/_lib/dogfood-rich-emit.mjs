#!/usr/bin/env node
/**
 * Shared rich dogfood burst (traces + runtime metrics) for rust / php / dotnet examples.
 * Requires dogfood-env.sh to export OTEL_* and OWLPANE_INGEST_*.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const nodePkg = join(here, "../apps/node/package.json");
const require = createRequire(nodePkg);
const { trace, metrics, SpanKind, SpanStatusCode } = require("@opentelemetry/api");
const { owlpane, shutdown, isEnabled } = require("@owlpane/node");

process.env.OWLPANE_METRICS_EXPORT_INTERVAL_MS ??= "3000";

owlpane.start({
  service: process.env.OTEL_SERVICE_NAME,
  endpoint: process.env.OWLPANE_INGEST_URL ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  ingestKey: process.env.OWLPANE_INGEST_KEY,
  environment: process.env.OWLPANE_ENVIRONMENT,
  release: "0.1.5",
});

if (!isEnabled()) {
  console.error("owlpane did not start — check examples/.env");
  process.exit(1);
}

const appId = process.env.OWLPANE_DOGFOOD_APP_ID ?? "node";
const rich = process.env.OWLPANE_DOGFOOD_MODE === "rich" || process.argv.includes("--rich");
const tracer = trace.getTracer("owlpane-dogfood");
const meter = metrics.getMeter("owlpane-dogfood");

const demoAttrs = { "http.request.method": "GET", "http.route": "/demo", "http.response.status_code": 200 };
if (appId === "php") {
  demoAttrs["laravel.route"] = "api/products.index";
  demoAttrs["php.framework"] = "laravel";
}

await tracer.startActiveSpan("GET /demo", { kind: SpanKind.SERVER, attributes: demoAttrs }, async (span) => {
  await new Promise((r) => setTimeout(r, 35));
  if (rich) {
    await tracer.startActiveSpan(
      "SELECT catalog",
      {
        kind: SpanKind.CLIENT,
        attributes: { "db.system": "mysql", "peer.service": "mysql-primary" },
      },
      async (db) => {
        await new Promise((r) => setTimeout(r, 12));
        db.end();
      },
    );
    if (appId === "php") {
      await tracer.startActiveSpan(
        "horizon.process OrderShipped",
        {
          kind: SpanKind.CONSUMER,
          attributes: { "messaging.system": "redis", "laravel.queue": "default", "job.name": "OrderShipped" },
        },
        async (job) => {
          await new Promise((r) => setTimeout(r, 8));
          job.end();
        },
      );
    }
  }
  span.end();
});

if (rich) {
  await tracer.startActiveSpan(
    "POST /checkout",
    {
      kind: SpanKind.SERVER,
      attributes: { "http.request.method": "POST", "http.route": "/checkout", "http.response.status_code": 500 },
    },
    async (errSpan) => {
      const err = new Error(`${appId} dogfood checkout failure`);
      errSpan.recordException(err);
      errSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      errSpan.end();
    },
  );

  const gauges = ["process.cpu.utilization"];
  if (appId === "go") gauges.push("process.runtime.go.goroutines", "go.memory.heap.alloc");
  if (appId === "rust") gauges.push("process.runtime.rust.threads");
  if (appId === "php") gauges.push("process.runtime.php.memory.usage");
  if (appId === "dotnet") gauges.push("process.runtime.dotnet.thread.count");
  for (const name of gauges) {
    const g = meter.createObservableGauge(name);
    g.addCallback((obs) => {
      const v =
        name.includes("goroutines") ? 48 + Math.floor(Math.random() * 20)
        : name.includes("thread") ? 12 + Math.floor(Math.random() * 6)
        : name.includes("memory") || name.includes("heap") ? 50_000_000 + Math.random() * 10_000_000
        : 0.18 + Math.random() * 0.12;
      obs.observe(v);
    });
  }
  await new Promise((r) => setTimeout(r, 3500));
}

await shutdown();
console.log(`dogfood emitted (${process.env.OTEL_SERVICE_NAME}, ${appId})`);
