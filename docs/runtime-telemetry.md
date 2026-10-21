# Runtime telemetry for Owlpane console boards

Runtime pages (`/observability/runtimes/:slug`) classify services from **resource** attributes and enrich boards from **spans** and **process/runtime metrics**.

## Resource (required for classification)

Set on every OTLP resource:

| Attribute | Example | Used for |
|-----------|---------|----------|
| `service.name` | `checkout-api` | App picker, filters |
| `telemetry.sdk.language` | `go`, `rust`, `php`, `dotnet`, `nodejs`, … | Runtime slug |
| `process.runtime.name` | `laravel`, `CPython`, `OpenJDK` | Fallback classification |
| `deployment.environment.name` | `production` | Env filter |

Slugs must match [observability-runtime.ts](../../api/src/observability/observability-runtime.ts) (`RUNTIME_SLUGS`).

## Spans (RED + dependencies + errors)

Export **Server** spans for HTTP/RPC entrypoints with:

- `http.route` / `http.request.method` / `http.response.status_code`
- `StatusCode` = Error when failed
- Exception events: `exception.type`, `exception.message`, `exception.stacktrace`

Export **Client** / **Producer** spans for dependencies:

- `db.system`, `db.name`, `db.statement` (sanitized)
- `peer.service` when known

### Framework-specific (optional, improves boards)

| Runtime | Span attributes |
|---------|-----------------|
| **PHP / Laravel** | `laravel.route`, `laravel.queue`, Horizon job names |
| **Python** | `messaging.system=celery`, Celery task names |
| **Ruby** | `messaging.system=sidekiq`, job class in span name |
| **Go** | Consumer spans (`SpanKind=Consumer`) for queue workers |
| **Java** | Kafka / JMS via `messaging.system` |
| **.NET** | Hangfire / MassTransit via `messaging.system` or span name |

## Metrics (vitals + charts)

Push OTLP metrics (same resource as traces). Names below map to runtime dashboard charts and **Runtime vitals** table.

| Runtime | Recommended metrics |
|---------|---------------------|
| **Node.js** | `nodejs.eventloop.delay.p95`, `nodejs.eventloop.utilization`, `v8js.memory.heap.used`, `process.cpu.utilization` |
| **Java** | `process.runtime.jvm.memory.usage`, `process.runtime.jvm.threads.count`, `jvm.gc.duration` |
| **Python** | `process.cpu.utilization`, `process.memory.usage` |
| **Go** | `process.runtime.go.goroutines`, `go.memory.heap.alloc`, `process.cpu.utilization` |
| **Rust** | `process.runtime.rust.threads`, `process.memory.usage` |
| **PHP** | `process.runtime.php.memory.usage`, `process.cpu.utilization` |
| **.NET** | `process.runtime.dotnet.gc.heap.size`, `process.runtime.dotnet.thread.count`, GC collection counters |

Use OpenTelemetry **runtime instrumentation** or the Owlpane agent where available. Node: `@owlpane/node` enables runtime metrics via `register.ts`.

## SDK helpers

| Package | Demo / conformance |
|---------|-------------------|
| `@owlpane/node` | `emitConsoleDemoSpan`, runtime metrics in register |
| `owlpane` (Go) | `EmitConsoleDemoSpan`, `TelemetrySDKLanguageGo` on resource |
| `owlpane` (Python) | `emit_console_demo_span()` |
| Java / Ruby | See package READMEs and `examples/run-dogfood.sh` |

After export, open **Observability → Runtimes → {language}** or run demo seed:  
`DEMO_ONLY=runtime node api/scripts/seed-demo-extended.mjs`.
