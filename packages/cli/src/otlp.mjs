import { randomBytes } from 'node:crypto'

export const hex = (n) => randomBytes(n).toString('hex')
const ns = (ms) => (BigInt(Math.round(ms * 1000)) * 1000n).toString()
const attr = (k, v) => ({ key: k, value: typeof v === 'number' ? (Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v }) : typeof v === 'boolean' ? { boolValue: v } : { stringValue: String(v) } })
export const attrs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => attr(k, v))

export function span({ traceId, parentSpanId, name, start, end, attributes = {}, error }) {
  return {
    traceId,
    spanId: hex(8),
    ...(parentSpanId ? { parentSpanId } : {}),
    name,
    kind: 1,
    startTimeUnixNano: ns(start),
    endTimeUnixNano: ns(end),
    attributes: attrs(attributes),
    status: error ? { code: 2, message: String(error).slice(0, 200) } : { code: 0 },
  }
}

/** Sends spans to the ingest gateway as OTLP/HTTP JSON under one resource. */
export async function sendSpans({ ingest, key }, service, spans, resource = {}) {
  if (!ingest) throw new Error('OWLPANE_INGEST_URL is not set (your ingest endpoint).')
  for (let i = 0; i < spans.length; i += 500) {
    const body = { resourceSpans: [{ resource: { attributes: attrs({ 'service.name': service, ...resource }) }, scopeSpans: [{ scope: { name: '@owlpane/cli' }, spans: spans.slice(i, i + 500) }] }] }
    const res = await fetch(`${ingest}/v1/traces`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`ingest rejected the spans: ${res.status} ${(await res.text()).slice(0, 200)}`)
  }
}
