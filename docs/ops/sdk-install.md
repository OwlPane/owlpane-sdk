# Installing Owlpane SDKs in Customer Applications

Customers install Owlpane SDKs from public package registries and authenticate against the Owlpane OTLP ingest gateway using project-scoped `owl_ing_*` keys.

## Standard Environment Variables

All Owlpane SDKs and OpenTelemetry exporters honor the following environment variables:

| Variable | Purpose | Example |
| --- | --- | --- |
| `OWLPANE_INGEST_URL` | Owlpane OTLP HTTP gateway URL | `https://ingest.owlpane.com` (or `http://127.0.0.1:4318` locally) |
| `OWLPANE_INGEST_KEY` | Project ingest key from **Setup** | `owl_ing_...` |
| `OWLPANE_SERVICE_NAME` | Service name (`service.name`) | `checkout-api` |
| `OWLPANE_ENVIRONMENT` | Deployment environment (`deployment.environment.name`) | `production` |

## Language SDK Installation

### Node.js & Browser (npm)

```bash
npm install @owlpane/node @owlpane/browser
```

Pin a version in `package.json`:

```json
{
  "dependencies": {
    "@owlpane/node": "^0.1.6",
    "@owlpane/browser": "^0.1.6"
  }
}
```

### Python (PyPI)

```bash
pip install owlpane
```

### Go

```bash
go get github.com/OwlPane/owlpane-sdk/packages/go@v0.1.6
```

### Java (Maven + agent)

Published artifact: `com.owlpane:owlpane-java` on GitHub Packages. Typical setup uses the **OpenTelemetry Java agent** plus `OWLPANE_*` / `OTEL_*` env — see [examples/apps/java](../../examples/apps/java).

### Ruby (GitHub Packages gem)

`gem install owlpane -v VERSION` from GitHub Packages; configure OTLP as in [examples/apps/ruby](../../examples/apps/ruby).

### Rust, PHP, .NET, React Native, Serverless

**Supported via standard OpenTelemetry** (same ingest keys and env). There is no separate Owlpane package on crates.io/Composer/NuGet yet — use the OTel SDK for your stack and follow the matching app under [`examples/apps/`](../../examples/README.md).

Full matrix (published vs OTel-native vs roadmap): **[platform-support.md](./platform-support.md)**.

## Recommended Starter Dashboards

After deploying an SDK, open **Dashboards → Library** (`/observability/dashboards/library`) or **Dashboards → Built-in templates** (`/observability/dashboards/templates`) to install golden-signal and runtime dashboards.

For **Observability → Runtimes** and **Serverless**, see the full [Runtime telemetry implementation guide](../runtime-telemetry.md) (resource attributes, spans, OTLP metrics, K8s agent, Collector, troubleshooting). Kubernetes: [agent runtime telemetry](../../agent/docs/runtime-telemetry.md).

## Publishing (Maintainers)

Releases are published on every `sdk-v*` tag from [owlpane-sdk](https://github.com/OwlPane/owlpane-sdk) via `.github/workflows/publish-sdk.yml`.

- Add **`NPM_TOKEN`** (npm automation token with publish access to the **`@owlpane`** scope) in the repo secrets.
- Create the **`@owlpane`** org on [npmjs.com](https://www.npmjs.com) and grant the token publish rights before the first release.

Legacy GitHub Packages (`@owlpane/owlpane-*`) is no longer used for Node/Browser.
