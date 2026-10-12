/**
 * POST a payload to one of the API's dry-run preview routes and return the JSON it answers. Nothing is saved on the
 * server. `c` is the config from config.mjs (api URL and token), already checked with requireApiToken.
 */
export async function postPreview(c, path, payload, fetchImpl = fetch) {
  const res = await fetchImpl(`${c.api}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${c.token}` },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`preview failed: ${res.status} ${body.message ?? ''}`.trim())
  return body
}

/** `1 rule`, `2 rules`; pass the plural for words that do not just add an s (`panel query`, `panel queries`). */
export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`
