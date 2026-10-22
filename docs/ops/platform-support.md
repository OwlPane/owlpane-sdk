# Platform & language support

Owlpane treats **OpenTelemetry OTLP** as the universal wire format. Customers integrate in two tiers; the **console Runtimes** and **Serverless** views accept telemetry from both.

## Tier A — Published Owlpane SDK (`sdk-v*` → Publish SDK)

One GitHub Actions workflow publishes **all six** packages on every `sdk-v*` tag:

| Console / runtime | Install | Registry |
|-------------------|---------|----------|
| Node.js | `npm install @owlpane/node@VERSION` | [npmjs.com](https://www.npmjs.com/package/@owlpane/node) |
| Browser (RUM) | `npm install @owlpane/browser@VERSION` | npm |
| Python | `pip install owlpane==VERSION` | [PyPI](https://pypi.org/project/owlpane/) |
| Go | `go get github.com/OwlPane/owlpane-sdk/packages/go@vVERSION` | Git tag `packages/go/vVERSION` |
| Java | `com.owlpane:owlpane-java:VERSION` | GitHub Packages Maven |
| Ruby | `gem install owlpane -v VERSION` | GitHub Packages RubyGems |

Machine-readable pins: `schema/install-snippets.json` (generated from `codegen/generate.ts`).

## Tier B — OpenTelemetry-native runtimes (supported today)

These languages **do not** have a separate npm/PyPI/crate release yet. They are **fully supported in product** when you export OTLP to Owlpane ingest with project keys and the resource/span attributes documented in [runtime-telemetry.md](../runtime-telemetry.md).

| Runtime | Console slug | Dogfood example | Notes |
|---------|--------------|-----------------|-------|
| Rust | `rust` | `examples/apps/rust` | OTel Rust SDK + `telemetry.sdk.language=rust` |
| PHP | `php` | `examples/apps/php` | Laravel-style spans, PHP runtime metrics |
| .NET | `dotnet` | `examples/apps/dotnet` | .NET runtime + GC metrics |
| React Native | `react-native` | `examples/apps/react-native` | Mobile resource attrs |
| Serverless | (Serverless tab) | `examples/apps/serverless` | Requires `faas.name` (and related) on spans |

**Required env (all tiers):** `OWLPANE_INGEST_URL`, `OWLPANE_INGEST_KEY`, `OTEL_SERVICE_NAME`, `OWLPANE_ENVIRONMENT` — see [sdk-install.md](./sdk-install.md).

K8s dogfood images for Tier B apps install **`@owlpane/node@VERSION`** only inside the **emitter** container to produce realistic OTLP for that language; customer apps should use the native OTel stack for that language.

## Tier C — Roadmap (thin generated packages)

Per [MULTILANGUAGE-SDK-ARCHITECTURE.md](../MULTILANGUAGE-SDK-ARCHITECTURE.md), **.NET**, **Rust**, and **PHP** will get `packages/*` thin starters (same contract as Go/Python) published alongside Tier A on future `sdk-v*` releases. Until then, Tier B + examples are the supported path.

## CI workflows (maintainers)

| Workflow | Role |
|----------|------|
| **Publish SDK** | Ship Tier A (6 languages) on `sdk-v*` |
| **CI** | Test monorepo on `main` / PRs |
| **Publish SDK example images** | GHCR dogfood images; runs after **Publish SDK** succeeds (or manual dispatch) |

Example images are **not** extra SDK languages; they validate published versions in cluster dogfood.
