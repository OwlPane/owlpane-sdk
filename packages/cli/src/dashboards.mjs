import { plural, postPreview } from './preview.mjs'

/** The server accepts up to 5 MB of dashboard JSON; fail here with a clear message instead of after the upload. */
export const MAX_DASHBOARD_BYTES = 5_000_000

/** `rate http_requests_total by route where service = $service (line)`: the proposed widget in one line. */
export function describeWidget(w) {
  const { metric, agg, groupBy, filters } = w.spec
  const by = groupBy ? ` by ${groupBy}` : ''
  const where = filters.length ? ` where ${filters.map((f) => `${f.key} ${f.op === 'neq' ? '!=' : '='} ${f.value}`).join(', ')}` : ''
  return `${agg} ${metric}${by}${where} (${w.chart})`
}

const totalsLine = (t) => `${t.translated ?? 0} translated, ${t.approximate ?? 0} approximate, ${t.unsupported ?? 0} unsupported`

/** The preview as text a person can read in a terminal or a CI log. */
export function formatDashboardPlan(plan) {
  const queries = plan.dashboards.reduce((n, d) => n + d.panels.length, 0)
  const lines = [`${plural(plan.dashboards.length, 'dashboard')}, ${plural(queries, 'panel query', 'panel queries')}: ${totalsLine(plan.totals ?? {})}`]
  for (const d of plan.dashboards) {
    lines.push('', `${d.title} (${d.importKey}): ${totalsLine(d.totals ?? {})}`)
    // a panel with several queries appears once per query; tell them apart by query id
    const seen = new Map()
    for (const p of d.panels) seen.set(`${p.panelId}:${p.panelTitle}`, (seen.get(`${p.panelId}:${p.panelTitle}`) ?? 0) + 1)
    for (const p of d.panels) {
      const name = seen.get(`${p.panelId}:${p.panelTitle}`) > 1 && p.refId ? `${p.panelTitle} (${p.refId})` : p.panelTitle
      lines.push(`  ${p.status.padEnd(11)} ${name}`)
      if (p.widget) lines.push(`              -> ${describeWidget(p.widget)}`)
      for (const note of p.notes) lines.push(`              ${note}`)
    }
  }
  for (const e of plan.errors ?? []) lines.push('', `error: ${e}`)
  if (plan.notes?.length) lines.push('', ...plan.notes)
  return lines.join('\n')
}

/** POST the dashboard JSON text to the dry-run endpoint and return the plan. Saves nothing on the server. */
export async function previewGrafana(c, text, fetchImpl = fetch) {
  if (Buffer.byteLength(text) > MAX_DASHBOARD_BYTES) throw new Error(`dashboard JSON is over ${MAX_DASHBOARD_BYTES / 1_000_000} MB; send fewer dashboards at a time`)
  let dashboards
  try {
    dashboards = JSON.parse(text)
  } catch {
    throw new Error('the dashboard file is not valid JSON')
  }
  return postPreview(c, '/v1/dashboards/import/grafana/preview', { dashboards }, fetchImpl)
}
