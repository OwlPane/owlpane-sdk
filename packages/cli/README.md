# @owlpane/cli

Send the data behind Owlpane's **Delivery** and **Security** pages from CI. Zero dependencies, Node 18+.

```bash
export OWLPANE_INGEST_KEY=owl_ing_…            # Projects & keys in the console
export OWLPANE_INGEST_URL=https://ingest.example.com   # OTLP endpoint (runs, tests, coverage)
export OWLPANE_API_URL=https://api.example.com         # API endpoint (findings)

# Security: SARIF (Semgrep, CodeQL, Checkov…), Trivy JSON, gitleaks, OSV-Scanner, CycloneDX SBOM
semgrep scan --sarif -o report.sarif
owlpane findings import sarif report.sarif --complete      # --complete marks findings the scan no longer reports as fixed

# Delivery
owlpane ci run --pipeline storefront-ci -- npm test            # times the command, reports pass/fail
owlpane ci run --pipeline storefront-deploy --deploy production --commit-time "$(git log -1 --format=%cI)" -- ./deploy.sh
owlpane test import junit junit.xml
owlpane coverage import lcov coverage/lcov.info
```

Repository, branch, commit and run id are read from GitHub Actions, GitLab CI, CircleCI, Buildkite or Jenkins
variables. A secret's value is never uploaded or stored: importers keep where it was found, not what it was.

**GitHub Action:** `sdk/actions/scan/action.yml` wraps the same commands.

**Status:** this package lives in the repository and is not published to npm yet; run it as
`node sdk/packages/cli/bin/owlpane.mjs …` until it is.
