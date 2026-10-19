# AGENTS.md — Owlpane SDK Monorepo (`owlpane/sdk`)

## Overview

`owlpane/sdk` houses the multi-language OpenTelemetry distributions, Browser RUM SDK (`@owlpane/browser`), Node SDK (`@owlpane/node`), CLI (`@owlpane/cli`), and runnable dogfood examples (`examples/`).

## Commands

- **Build & test workspace packages**: `npm test`
- **Onboard dogfood projects** (local or SaaS): copy `examples/.env.local.example` or `examples/.env.saas.example` to `examples/.env`, then `./examples/scripts/onboard-dogfood.sh --write-env`
- **Run local full-stack demo**:
  - One-shot rich telemetry (traces + metrics + logs + browser RUM): `./examples/scripts/run-local-demo.sh --once`
  - Continuous demo-server load: `./examples/scripts/run-local-demo.sh --loop`

## Engineering & Branding Rules

1. **Zero-overhead when unconfigured**: Language SDK `start()` functions must no-op cleanly when `OWLPANE_INGEST_URL` / `OTEL_EXPORTER_OTLP_ENDPOINT` is unset.
2. **Standard credentials**: Always use `owl_ing_*` project ingest keys sent via `Authorization: Bearer <key>` to `:4318` (`ingest.owlpane.com` in cloud).
3. **Customer-facing READMEs**: Keep all package and example READMEs focused on Owlpane and OpenTelemetry standards without referencing competitor observability vendors.
