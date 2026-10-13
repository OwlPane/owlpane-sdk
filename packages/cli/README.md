# @owlpane/cli

Send the data behind Owlpane's **Delivery** and **Security** pages from CI. Zero dependencies, Node 18+.

```bash
export OWLPANE_INGEST_KEY=owl_ing_…            # Projects & keys in the console
export OWLPANE_INGEST_URL=https://ingest.example.com   # OTLP endpoint (runs, tests, coverage)
export OWLPANE_API_URL=https://api.example.com         # API endpoint (findings)

# Security: SARIF (Semgrep, CodeQL, Checkov…), Trivy JSON, gitleaks, OSV-Scanner, CycloneDX SBOM
semgrep scan --sarif -o report.sarif
owlpane findings import sarif report.sarif --complete      # --complete also closes findings this scan no longer reports (read the note below)

# Delivery
owlpane ci run --pipeline storefront-ci -- npm test            # times the command, reports pass/fail
owlpane ci run --pipeline storefront-deploy --deploy production --commit-time "$(git log -1 --format=%cI)" -- ./deploy.sh
owlpane test import junit junit.xml
owlpane coverage import lcov coverage/lcov.info
```

**`--complete`** marks open findings of the file's kind as fixed when the scan no longer reports them. It is limited by the `--repo` and `--service` you give. The repository is read from GitHub Actions, GitLab CI, CircleCI, Buildkite or Jenkins variables when you do not pass `--repo`; the service is never detected. So pass `--repo` anywhere else (a laptop, or a CI system the CLI does not recognise): with no repository the sweep covers every repo in your workspace for that kind, and with no `--service` it covers every service in the repo. The CLI prints a warning when `--complete` has no repository.

Repository, branch, commit and run id are read from GitHub Actions, GitLab CI, CircleCI, Buildkite or Jenkins
variables. A secret's value is never uploaded or stored: importers keep where it was found, not what it was.

**GitHub Action:** `sdk/actions/scan/action.yml` wraps the same commands.

## Preview a Prometheus alert migration

```bash
export OWLPANE_API_URL=https://api.example.com
export OWLPANE_TOKEN=owl_pat_…        # a read-only API token (Settings, API tokens); an ingest key is refused

owlpane alerts import prometheus rules.yaml
kubectl get prometheusrules -A -o yaml | owlpane alerts import prometheus -     # - reads stdin
owlpane alerts import prometheus rules.yaml --json > plan.json                   # the full plan
```

It prints, for each rule, whether Owlpane can `translate` it, only `approximate` it (with what differs), or not
translate it (with why). It is a dry run: nothing is saved, proposed rules are disabled, and the exit code is 0
whatever the result. Owlpane alert rules measure fixed built-in metrics, not free PromQL, so expect some rules to
be unsupported. Details: `docs/migrations/from-prometheus.md` in `owlpane-api`.

## Preview a Grafana dashboard migration

```bash
export OWLPANE_API_URL=https://api.example.com
export OWLPANE_TOKEN=owl_pat_…        # the same read-only API token

owlpane dashboards import grafana dashboard.json                    # a Grafana export (or the API's { dashboard } wrapper)
curl -s -H "Authorization: Bearer $GRAFANA_TOKEN" "$GRAFANA/api/dashboards/uid/<uid>" | owlpane dashboards import grafana -
owlpane dashboards import grafana dashboards.json --json > plan.json   # the full plan, with a body POST /v1/dashboards accepts
```

For each panel query it prints the Owlpane metric widget it would become, or why none fits (histogram quantiles,
tables, arithmetic between queries and non-Prometheus data sources have no widget). Like the alert preview it saves
nothing, and the exit code is 0 whatever the result. Details: `docs/migrations/from-grafana-dashboards.md` in `owlpane-api`.

**Status:** this package lives in the repository and is not published to npm yet; run it as
`node sdk/packages/cli/bin/owlpane.mjs …` until it is.
