# Runtime telemetry — implementation guide

Owlpane **Observability → Runtimes** (`/observability/runtimes/:slug`) and **Serverless** classify telemetry from OTLP **resource** attributes, then render RED metrics, dependency tables, workload splits, and **time-series charts** from spans and runtime metrics.

Canonical slug and metric lists live in the API: [`observability-runtime.ts`](../../api/src/observability/observability-runtime.ts). Console boards call `GET /v1/menu-dashboards/runtime?runtime=…`.

---

## 1. Checklist (every language)

| Step | Detail |
|------|--------|
| Resource | `service.name`, `telemetry.sdk.language`, `deployment.environment.name` on every signal |
| Traces | **Server** spans for HTTP/RPC; **Client** for DB/HTTP/messaging; errors with exception events |
| Metrics | OTLP **metrics** on the same ingest URL (`/v1/metrics`) with the same resource |
| Auth | `Authorization: Bearer owl_ing_…` (or `OTEL_EXPORTER_OTLP_HEADERS`) |
| Verify | Console env filter matches `deployment.environment.name`; time range includes your traffic |

Disable runtime metrics export: `OWLPANE_RUNTIME_METRICS=0` (Go/Python SDK).

---

## 2. Resource attributes

| Attribute | Example | Used for |
|-----------|---------|----------|
| `service.name` | `checkout-api` | App picker, scope |
| `telemetry.sdk.language` | `go`, `python`, `java`, `nodejs`, … | Runtime slug |
| `process.runtime.name` | `laravel`, `CPython`, `OpenJDK` | Fallback slug |
| `deployment.environment.name` | `production` | Env dropdown |

**Slugs:** `nodejs`, `java`, `python`, `ruby`, `go`, `rust`, `php`, `dotnet`, `react-native`.  
**Serverless:** spans with `faas.name` (not a language slug).

---

## 3. Spans (RED, errors, dependencies)

**Server** entry spans:

- `http.route`, `http.request.method`, `http.response.status_code`
- `SpanKind` = Server; `StatusCode` = Error on failure
- Exception events: `exception.type`, `exception.message`

**Client** dependency spans:

- `db.system`, `peer.service`, sanitized `db.statement`
- Messaging: `messaging.system`, queue/topic attributes

### Framework attributes (optional)

| Runtime | Attributes |
|---------|------------|
| PHP / Laravel | `laravel.route`, `laravel.queue`, `php.framework` |
| Python | `messaging.system=celery`, task name in span |
| Ruby | `messaging.system=sidekiq` |
| Go / Java / .NET | Consumer spans + `messaging.system` |
| React Native | `screen.name`, `telemetry.sdk.language=react-native`, `os.type` |
| Serverless | `faas.name`, `faas.trigger`, `faas.coldstart`, `cloud.region` |

**Go / Node probe noise:** health/readiness routes are excluded from **Slowest operations** on runtime boards (not from RED totals).

---

## 4. Metrics (vitals + charts)

Export OTLP metrics with the **same resource** as traces. The API charts these names (see `runtimeMetricNames()`):

| Runtime | Metrics |
|---------|---------|
| **Node.js** | `nodejs.eventloop.delay.p95`, `nodejs.eventloop.utilization`, `v8js.memory.heap.used`, `process.cpu.utilization`, `process.memory.usage` |
| **Java** | JVM heap/non-heap memory (`process.runtime.jvm.memory.*`, `jvm.memory.*`), GC duration by collector, thread counts, `process.cpu.utilization` — enable with OTel Java agent + `OTEL_METRICS_EXPORTER=otlp` |
| **Python** | `process.cpu.utilization`, `process.memory.usage`, plus Owlpane SDK gauges: `process.runtime.python.thread_count`, `process.runtime.python.gc.count`, `process.runtime.python.memory` |
| **Ruby** | `process.runtime.ruby.heap.use`, `process.runtime.ruby.gc.count`, `process.runtime.ruby.thread_count`, `process.memory.usage` — see `examples/apps/ruby/metrics.rb` |
| **Go** | `process.runtime.go.goroutines`, `go.memory.heap.alloc`, `process.cpu.utilization` |
| **Rust** | `process.runtime.rust.threads`, `process.memory.usage` |
| **PHP** | `process.runtime.php.memory.usage`, `process.cpu.utilization` |
| **.NET** | `process.runtime.dotnet.gc.heap.size`, `process.runtime.dotnet.thread.count`, GC counters |
| **React Native** | `process.cpu.utilization`, `process.memory.usage` (+ mobile RUM spans) |

**Workload split charts** (HTTP vs queue/workers) appear when spans include messaging/Horizon/Celery/Sidekiq patterns — see `runtimeWorkloadSplitExpr()` in the API.

---

## 5. Owlpane SDKs

| Package | Traces | Runtime metrics |
|---------|--------|-----------------|
| **`@owlpane/node`** | Auto HTTP/DB + `start()` | Yes — event loop, V8, process (`OWLPANE_METRICS_EXPORT_INTERVAL_MS`) |
| **`owlpane` (Go)** | `Start()` / `Shutdown()` | Yes — `go.opentelemetry.io/contrib/instrumentation/runtime` (default on) |
| **`owlpane` (Python)** | `start()` / `shutdown()` | Yes — system metrics instrumentation (default on) |
| **`@owlpane/browser`** | RUM spans | Browser vitals (Frontend tab) |
| **Java / Ruby / .NET / PHP / Rust** | Examples + OTel agents | See `examples/apps/*` and language READMEs |

Env vars (all SDKs): `OWLPANE_INGEST_URL`, `OWLPANE_INGEST_KEY`, `OTEL_SERVICE_NAME`, `OWLPANE_ENVIRONMENT`.

---

## 6. Zero-code agents

### Java (OpenTelemetry Java agent)

```bash
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=none
export OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.example.com
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer owl_ing_…"
java -javaagent:opentelemetry-javaagent.jar -jar app.jar
```

Reference: [`examples/apps/java/run.sh`](../examples/apps/java/run.sh).

### Python (`opentelemetry-instrument`)

```bash
opentelemetry-bootstrap -a install
export OTEL_METRICS_EXPORTER=otlp
opentelemetry-instrument python app.py
```

Or use `owlpane.start()` which enables system metrics when the optional dependency is installed.

### Node

`node --import @owlpane/node/register` or `@opentelemetry/auto-instrumentations-node` with metrics exporter set to `otlp`.

---

## 7. Kubernetes (Owlpane agent)

1. Install the [Owlpane Helm agent](https://github.com/OwlPane/owlpane-agent) with the node agent OTLP receiver on `:4318`.
2. Enable **`autoInstrumentation`** in values — creates an OpenTelemetry Operator `Instrumentation` named `owlpane` with **traces + metrics** OTLP export to the node agent.
3. Opt-in per pod:

```yaml
metadata:
  annotations:
    instrumentation.opentelemetry.io/inject-java: "<namespace>/owlpane"
    # or inject-nodejs, inject-python, inject-dotnet, inject-go
```

The node agent forwards OTLP to your Owlpane ingest with cluster/resource attributes. See [`agent/docs/runtime-telemetry.md`](../../agent/docs/runtime-telemetry.md).

---

## 8. OpenTelemetry Collector / third-party

Add Owlpane as an OTLP/HTTP exporter for **traces and metrics** (same headers):

```yaml
exporters:
  otlphttp/owlpane:
    endpoint: https://ingest.example.com
    headers:
      Authorization: "Bearer owl_ing_…"
service:
  pipelines:
    traces: { receivers: [otlp], exporters: [otlphttp/owlpane] }
    metrics: { receivers: [otlp], exporters: [otlphttp/owlpane] }
```

Ingest accepts standard OTLP protobuf/JSON; no custom runtime wire format.

---

## 9. Local dogfood

```bash
cd sdk/examples
./scripts/onboard-dogfood.sh --write-env
./run-dogfood.sh --once
./scripts/run-dogfood-loop-daemon.sh restart   # Node continuous + other runtimes ~45s
```

Open `http://127.0.0.1:4200/observability/runtimes/{slug}` with env **development** and **LAST 6H**. See [`examples/README.md`](../examples/README.md).

---

## 10. Console deep dive (granularity)

Four levels on each **Runtimes** page:

| Level | Where | Action |
|-------|--------|--------|
| **1 Runtime** | Whole language tab | **Apps in this runtime** table — click a service |
| **2 App** | Filter bar or app row | **Instances / hosts**, **HTTP routes**, RED cards |
| **3 Route / operation** | **HTTP routes**, **Slowest operations** | Opens **Requests** (route filter) or **Spans** (operation search) |
| **4 Request / trace** | Requests list | Open trace detail, logs, errors on that request |

Also:

- **Runtime trends** — p95, workload split, OTLP runtime metrics (dogfood loop fills charts).
- **Runtime vitals** — metric name → **Metrics explorer**.
- **Dependencies** — target + `db.system` → **Database queries**.

**Profiling** tab remains continuous CPU (`OWLPANE_PROFILING=1` on Node).

## 11. Troubleshooting

| Symptom | Fix |
|---------|-----|
| “No telemetry” empty state | Wrong env, no spans in range, or missing `telemetry.sdk.language` |
| RED but no vitals/charts | Metrics not exported or names don’t match `runtimeMetricNames` |
| Java board flat | Set `OTEL_METRICS_EXPORTER=otlp`; keep JVM alive long enough to flush metrics |
| Go slowest ops all `/health` | Fixed in API for boards; reduce probe traffic or filter in app |
| Serverless blank | Need `faas.name` on spans |
| API “Observability query failed” | ClickHouse/store connectivity; check API logs |

---

## References

- API runtime SQL: `owlpane/api/src/observability/observability-runtime.ts`
- Dashboard assembly: `owlpane/api/src/product/menu-dashboards.service.ts` (`runtime()`, `serverless()`)
- Install hub: [`docs/ops/sdk-install.md`](ops/sdk-install.md)
- Public docs mirror: `owlpane-docs/docs/sdk/runtime-telemetry.md`
