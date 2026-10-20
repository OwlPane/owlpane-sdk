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
./run-dogfood.sh              # one shot per runtime
./run-dogfood.sh --loop       # continuous demo-server (traces + metrics + logs every ~3s)
```

Set `OWLPANE_DOGFOOD_MODE=rich` to emit multi-span traces (`GET /demo` + `SELECT orders`), error spans with recorded exceptions (`POST /checkout`), OTLP metrics (`owlpane.dogfood.requests`, `http.server.request.duration`), and trace-correlated structured logs.

## Local dogfood (localhost API + ingest)

Copy [`.env.local.example`](.env.local.example) to `.env`. Point **`OWLPANE_API_URL`** and **`OWLPANE_INGEST_URL`** at your local stack (default `http://localhost:4100` and `http://localhost:4318`). Run `./scripts/onboard-dogfood.sh --write-env` then `./run-dogfood.sh`.

Do **not** use SaaS credentials against localhost unless you set `OWLPANE_DOGFOOD_ALLOW_LOCALHOST=1` (discouraged).

## SaaS dogfood (production ingest)

Copy [`.env.saas.example`](.env.saas.example) to `.env`. Set **`OWLPANE_INGEST_URL`** from console **Setup → Projects & keys** (same value the API advertises as public ingest), plus **`OWLPANE_ONBOARD_PASSWORD`**. **`OWLPANE_API_URL`** must be the public API host (e.g. `https://owlpane-api.crikiq.com`), not localhost.

```bash
chmod +x scripts/run-saas-dogfood.sh scripts/onboard-dogfood.sh run-dogfood.sh
./scripts/run-saas-dogfood.sh              # onboard + one rich burst (8 projects incl. demo + PII)
./scripts/run-saas-dogfood.sh --loop-demo  # continuous load for Home charts
./pii-canary/run.sh                        # optional PII scrub stream
```

**What this covers:** OTLP from all SDK runtimes, browser RUM, `owlpane-demo-server`, and project **`pii-canary`** (onboarded via `dogfood.manifest.json`).

**What this does not cover:** Kubernetes cluster metrics, infra alert templates, and network/security views — those need the **[owlpane-agent](https://github.com/OwlPane/owlpane-agent)** on your cluster. Follow [kubernetes-e2e.md](https://github.com/OwlPane/owlpane-api/blob/main/docs/ops/kubernetes-e2e.md) on the API repo.

Open **Applications**, **Requests**, **Logs**, and **Metrics explorer** on your workspace console (`OWLPANE_CONSOLE_URL`). Match the **Deploy env** filter to `OWLPANE_ENVIRONMENT` (e.g. `production`).

## Local full-stack test (`:4318` cell + `:4100` API + `:4200` console)

Copy [`.env.local.example`](.env.local.example) or let `run-local-demo.sh` onboard automatically against your local stack:

1. **Telemetry cell**: Start the local ingest gateway on `http://127.0.0.1:4318` (and ClickHouse storage).
2. **Control plane API**: Start `owlpane/api` on `http://127.0.0.1:4100`.
3. **Web console**: Start `owlpane/console` on `http://127.0.0.1:4200` (Vite proxies `/v1` to the API).
4. **Emit one-shot rich telemetry across all runtimes**:
   ```bash
   ./scripts/run-local-demo.sh --once
   ```
5. **Run continuous load for live dashboard charts**:
   ```bash
   ./scripts/run-local-demo.sh --loop
   # or same as: ./run-dogfood.sh --loop
   ```

### Docker Desktop (continuous demo-server container)

With the cell ingest bound on the host (`127.0.0.1:4318` from `stumpcam/deploy`):

```bash
./scripts/onboard-dogfood.sh --write-env
chmod +x scripts/run-docker-dogfood.sh
./scripts/run-docker-dogfood.sh          # build + run; restart policy keeps it up
docker compose -f docker-compose.dogfood.yml down   # stop
```

The container sends to `http://host.docker.internal:4318`. Watch **Requests** / **Metrics explorer** for `owlpane-demo-server`.

### Kubernetes agent on Docker Desktop

Cluster metrics and the **Kubernetes** console views need the Helm agent (not the SDK examples alone). Use **Docker Desktop’s** built-in cluster (`docker-desktop` context), not a remote kube context:

```bash
kubectl config use-context docker-desktop
cd ../../api
export OWLPANE_INGEST_KEY=owl_ing_…   # from examples/.env after onboard
chmod +x scripts/deploy-agent-docker-desktop.sh
./scripts/deploy-agent-docker-desktop.sh
```

Console cluster name: **`docker-desktop`**, environment **`production`** (matches the live agent values). See [kubernetes-e2e.md](../../api/docs/ops/kubernetes-e2e.md).

### Console verification checklist (`http://127.0.0.1:4200`)

- **Applications**: Open **Applications** and select **development** environment to see `owlpane-sdk-node`, `owlpane-sdk-python`, `owlpane-sdk-go`, `owlpane-sdk-java`, and `owlpane-sdk-ruby`.
- **Requests**: Open **Requests** (`/observability/requests`) and inspect `GET /demo` (with child `SELECT orders` DB span) and `POST /checkout` (with recorded error exception). Open a trace and use **full screen** on a span detail (T9).
- **Logs**: Open **Logs** (`/observability/logs`), filter by `owlpane-sdk-node` or `owlpane-demo-server`, verify trace-correlated log records. Expand **Fields** → **Show more values** on `customer.tier` (exact counts over the range, L3). Group **Lines over time** by `customer.tier` (L17).
- **Search**: Open **Search**, run a span filter, use **What's different?** with baseline **Just before** (T3).
- **Metrics**: Open **Metrics explorer** (`/observability/explorer`) and query `owlpane.dogfood.requests` or `http.server.request.duration`.
- **Browser / Frontend RUM**: Open **Frontend** to see `owlpane-sdk-browser` `documentLoad` spans, feature flags (`checkout-redesign`), experiments (`exp-cart-2026`), and captured exceptions.
- **Dashboards Hub**: Open **Dashboards → Library** (`/observability/dashboards/library`) or **Built-in templates** (`/observability/dashboards/templates`) and install a starter dashboard; try a **logs** widget grouped by an attribute (L17).

## Other samples

| Path | Purpose |
|------|---------|
| [`apps/demo-server/`](apps/demo-server/) | Continuous HTTP + interval load generator emitting traces, metrics, and logs |
| [`conformance/`](conformance/) | Plain OTel samples + `_receiver` for CI/docs (no real ingest) |
| [`pii-canary/`](pii-canary/) | PII scrub verification against a live ingest |
| [`_receiver/`](_receiver/) | Throwaway OTLP receiver used by package conformance tests |
