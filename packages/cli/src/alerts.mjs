import { plural, postPreview } from './preview.mjs'

/** The server accepts up to 2 MB of rules text; fail here with a clear message instead of after the upload. */
export const MAX_RULES_BYTES = 2_000_000

/** `error_rate > 5 over 5 min (service api)`: the proposed rule in one line. */
export function describeRule(rule) {
  const scope = [rule.service && `service ${rule.service}`, rule.environment && `environment ${rule.environment}`].filter(Boolean)
  return `${rule.metric} ${rule.comparator === 'lt' ? '<' : '>'} ${rule.threshold} over ${rule.windowMinutes} min${scope.length ? ` (${scope.join(', ')})` : ''}`
}

/** The preview as text a person can read in a terminal or a CI log. */
export function formatPlan(plan) {
  const t = plan.totals ?? {}
  const lines = [
    `${plural(plan.rules.length, 'alerting rule')} in ${plural(plan.groups, 'group')}: ${t.translated ?? 0} translated, ${t.approximate ?? 0} approximate, ${t.unsupported ?? 0} unsupported` +
      (plan.recordingRules ? ` (${plural(plan.recordingRules, 'recording rule')} skipped)` : ''),
    '',
  ]
  for (const r of plan.rules) {
    lines.push(`${r.status.padEnd(11)} ${r.importKey}`)
    if (r.rule) lines.push(`            -> ${describeRule(r.rule)}`)
    for (const note of r.notes) lines.push(`            ${note}`)
  }
  for (const e of plan.errors ?? []) lines.push(`error: ${e}`)
  if (plan.rules.length) lines.push('')
  for (const n of plan.notes ?? []) lines.push(n)
  return lines.join('\n')
}

/** POST the rules text to the dry-run endpoint and return the plan. Saves nothing on the server. */
export async function previewPrometheus(c, text, fetchImpl = fetch) {
  if (Buffer.byteLength(text) > MAX_RULES_BYTES) throw new Error(`rules text is over ${MAX_RULES_BYTES / 1_000_000} MB; split the file`)
  return postPreview(c, '/v1/alerts/import/prometheus/preview', { rules: text }, fetchImpl)
}

/** POST apply: creates disabled rules from the preview plan. Requires alerts:write on the token. */
export async function applyPrometheus(c, text, { includeApproximate = false } = {}, fetchImpl = fetch) {
  if (Buffer.byteLength(text) > MAX_RULES_BYTES) throw new Error(`rules text is over ${MAX_RULES_BYTES / 1_000_000} MB; split the file`)
  return postPreview(c, '/v1/alerts/import/prometheus', { rules: text, ...(includeApproximate ? { includeApproximate: true } : {}) }, fetchImpl)
}
