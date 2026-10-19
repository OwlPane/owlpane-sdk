# SDK dogfood examples

Runnable example applications that install the **published** Owlpane SDKs (or standard OpenTelemetry exporters) and emit traces, metrics, structured logs, and browser RUM telemetry to your Owlpane ingest gateway.

## Standard onboarding (one project per app)

In the console, create **six projects** (names must match `dogfood.manifest.json`):

| Console project | Example app | Package / path |
|-----------------|-------------|----------------|
| `owlpane-sdk-node` | [`apps/node`](apps/node) | `@owlpane/node@0.1.5` (npmjs.com) |
| `owlpane-sdk-go` | [`apps/go`](apps/go) | `github.com/OwlPane/owlpane-sdk/packages/go@v0.1.5` |
| `owlpane-sdk-python` | [`apps/python`](apps/python) | `owlpane==0.1.5` (PyPI) |
| `owlpane-sdk-java` | [`apps/java`](apps/java) | OpenTelemetry **javaagent** + `OTEL_*` env |
| `owlpane-sdk-ruby` | [`apps/ruby`](apps/ruby) | `opentelemetry-sdk` + OTLP exporter |
| `owlpane-sdk-browser` | [`apps/browser`](apps/browser) | `@owlpane/browser@0.1.5` (Browser RUM) |

Each project gets its **own ingest key** (`owl_ing_*`). `OTEL_SERVICE_NAME` is set to the project slug (same rule as **InstallGuide** in the console).

```bash
chmod +x run-dogfood.sh scripts/onboard-dogfood.sh scripts/run-local-demo.sh apps/*/run.sh
# Creates console projects + keys (Scale org by default), writes examples/.env:
./scripts/onboard-dogfood.sh --write-env
./run-dogfood.sh
```

Set `OWLPANE_DOGFOOD_MODE=rich` to emit multi-span traces (`GET /demo` + `SELECT orders`), error spans with recorded exceptions (`POST /checkout`), OTLP metrics (`owlpane.dogfood.requests`, `http.server.request.duration`), and trace-correlated structured logs.

## Local full-stack test (`:4318` cell + `:4100` API + `:5173` console)

Copy [`.env.local.example`](.env.local.example) or let `run-local-demo.sh` onboard automatically against your local stack:

1. **Telemetry cell**: Start the local ingest gateway on `http://127.0.0.1:4318` (and ClickHouse storage).
2. **Control plane API**: Start `owlpane/api` on `http://127.0.0.1:4100`.
3. **Web console**: Start `owlpane/console` on `http://127.0.0.1:5173`.
4. **Emit one-shot rich telemetry across all runtimes**:
   ```bash
   ./scripts/run-local-demo.sh --once
   ```
5. **Run continuous load for live dashboard charts**:
   ```bash
   ./scripts/run-local-demo.sh --loop
   ```

### Console verification checklist (`http://127.0.0.1:5173`)

- **Applications**: Open **Applications** and select **development** environment to see `owlpane-sdk-node`, `owlpane-sdk-python`, `owlpane-sdk-go`, `owlpane-sdk-java`, and `owlpane-sdk-ruby`.
- **Traces**: Open **Traces** (`/observability/traces`) and inspect `GET /demo` (with child `SELECT orders` DB span) and `POST /checkout` (with recorded error exception).
- **Logs**: Open **Logs** (`/observability/logs`) and filter by `owlpane-sdk-node` or `owlpane-demo-server` to verify trace-correlated log records.
- **Metrics**: Open **Metrics** (`/observability/metrics`) and query `owlpane.dogfood.requests` or `http.server.request.duration`.
- **Browser / Frontend RUM**: Open **Frontend** to see `owlpane-sdk-browser` `documentLoad` spans, feature flags (`checkout-redesign`), experiments (`exp-cart-2026`), and captured exceptions.
- **Dashboards Hub**: Open **Dashboards → Library** (`/observability/dashboards/library`) or **Built-in templates** (`/observability/dashboards/templates`) and install a starter dashboard.

## Other samples

| Path | Purpose |
|------|---------|
| [`apps/demo-server/`](apps/demo-server/) | Continuous HTTP + interval load generator emitting traces, metrics, and logs |
| [`conformance/`](conformance/) | Plain OTel samples + `_receiver` for CI/docs (no real ingest) |
| [`pii-canary/`](pii-canary/) | PII scrub verification against a live ingest |
| [`_receiver/`](_receiver/) | Throwaway OTLP receiver used by package conformance tests |
