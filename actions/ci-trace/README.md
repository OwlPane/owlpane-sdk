# GitHub Action: CI workflow traces (K4)

Epic **K4** / **G-032** / OpenSRE **OS3**: emit OpenTelemetry traces for GitHub Actions workflow, job, and step spans into Owlpane ingest.

## Status

**Scaffold** — [`action.yml`](action.yml) validates inputs and documents the span model; full OTLP export is a follow-up. Use [`../scan/action.yml`](../scan/action.yml) for pipeline run export today.

## Intended usage

```yaml
- uses: owlpane/actions/ci-trace@v0
  with:
    ingest-key: ${{ secrets.OWLPANE_INGEST_KEY }}
    ingest-url: https://ingest.example.com
    service: my-repo
    workflow: ci.yml
```

## Span model (draft)

| Span | Attributes |
|------|------------|
| `github.workflow` | `github.workflow`, `github.run_id`, `github.ref` |
| `github.job` | `github.job`, runner OS |
| `github.step` | `github.step`, conclusion |

Correlate with logs via `trace_id` on CI log lines when using structured logging.

## Related

- [opensre.md](../../../api/docs/competitive/opensre.md) — OS-INT
- [21-observability-gap-tracker.md](../../../api/docs/21-observability-gap-tracker.md) #14
