/** Where to send things. The ingest key is the same write-only key the SDKs use; `token` is an API token for commands that read. */
export function config(env = process.env) {
  const key = env.OWLPANE_INGEST_KEY?.trim()
  const ingest = (env.OWLPANE_INGEST_URL || env.OTEL_EXPORTER_OTLP_ENDPOINT || '').replace(/\/+$/, '')
  const api = (env.OWLPANE_API_URL || '').replace(/\/+$/, '')
  const token = env.OWLPANE_TOKEN?.trim()
  return { key, ingest, api, token }
}

/** For commands that call the API as a person would (not as a pipeline): a read-only owl_pat_ token, never an ingest key. */
export function requireApiToken(c) {
  if (!c.api) throw new Error('OWLPANE_API_URL is not set (for example https://api.example.com).')
  if (!c.token) throw new Error('OWLPANE_TOKEN is not set. Create a read-only API token in Owlpane, under Settings, API tokens.')
  if (!c.token.startsWith('owl_pat_')) throw new Error('OWLPANE_TOKEN must be an Owlpane API token (it starts with owl_pat_). Ingest keys are not accepted here.')
  let url
  try {
    url = new URL(c.api)
  } catch {
    throw new Error('OWLPANE_API_URL is not a valid URL.')
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('OWLPANE_API_URL must use https (plain http is only allowed for localhost).')
}

export function requireKey(c) {
  if (!c.key) throw new Error('OWLPANE_INGEST_KEY is not set (create one under Projects & keys in the console).')
}
