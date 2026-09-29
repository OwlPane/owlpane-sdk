/** Where to send things. The ingest key is the same write-only key the SDKs use. */
export function config(env = process.env) {
  const key = env.OWLPANE_INGEST_KEY?.trim()
  const ingest = (env.OWLPANE_INGEST_URL || env.OTEL_EXPORTER_OTLP_ENDPOINT || '').replace(/\/+$/, '')
  const api = (env.OWLPANE_API_URL || '').replace(/\/+$/, '')
  return { key, ingest, api }
}

export function requireKey(c) {
  if (!c.key) throw new Error('OWLPANE_INGEST_KEY is not set (create one under Projects & keys in the console).')
}
