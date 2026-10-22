# Published SDK version for examples

**Registry truth:** npm / PyPI / Go module tags ship on **`sdk-v*`** releases via `.github/workflows/publish-sdk.yml`.

**Single pin** (cluster images + `OWLPANE_SDK_SOURCE=published`):

```text
examples/sdk-published.version   → 0.1.6
```

Cut a release:

```bash
git tag sdk-v$(tr -d ' \n' < examples/sdk-published.version)
git push origin "sdk-v$(tr -d ' \n' < examples/sdk-published.version)"
```

After registries have **0.1.6**, run **Publish SDK example images** (or push `examples/**` to `main`).

Local dev against workspace SDKs: `OWLPANE_SDK_SOURCE=local` and existing `replace` / `-e` paths in `requirements.txt` / `go.mod`.
