import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { describeRule, formatPlan, MAX_RULES_BYTES, previewPrometheus } from '../src/alerts.mjs'
import { config, requireApiToken } from '../src/config.mjs'

const BIN = fileURLToPath(new URL('../bin/owlpane.mjs', import.meta.url))
const TOKEN = 'owl_pat_abc123'

// the shape POST /v1/alerts/import/prometheus/preview returns (trimmed to the fields the CLI reads)
const PLAN = {
  groups: 1,
  recordingRules: 1,
  rules: [
    { importKey: 'kubernetes-apps/KubePodCrashLooping', status: 'approximate', rule: { metric: 'k8s_crashing_pods', service: '', environment: '', comparator: 'gt', threshold: 0, windowMinutes: 5 }, notes: ['"for: 15m" keeps the alert pending.'] },
    { importKey: 'kubernetes-apps/HighErrorRate', status: 'translated', rule: { metric: 'error_rate', service: 'api', environment: '', comparator: 'gt', threshold: 5, windowMinutes: 5 }, notes: ['Judged only with 20+ requests.'] },
    { importKey: 'kubernetes-apps/HostDiskLow', status: 'unsupported', rule: null, notes: ['Host resource thresholds are not supported.'] },
  ],
  totals: { translated: 1, approximate: 1, unsupported: 1 },
  errors: [],
  notes: ['Proposed rules are disabled until a person enables them.'],
}

test('a rule reads as one line, with its scope when it has one', () => {
  assert.equal(describeRule(PLAN.rules[0].rule), 'k8s_crashing_pods > 0 over 5 min')
  assert.equal(describeRule(PLAN.rules[1].rule), 'error_rate > 5 over 5 min (service api)')
  assert.equal(describeRule({ metric: 'x', comparator: 'lt', threshold: 2, windowMinutes: 10, service: 'prod', environment: 'eu' }), 'x < 2 over 10 min (service prod, environment eu)')
})

test('the plan prints as a summary, one block per rule, and the server notes', () => {
  assert.equal(
    formatPlan(PLAN),
    [
      '3 alerting rules in 1 group: 1 translated, 1 approximate, 1 unsupported (1 recording rule skipped)',
      '',
      'approximate kubernetes-apps/KubePodCrashLooping',
      '            -> k8s_crashing_pods > 0 over 5 min',
      '            "for: 15m" keeps the alert pending.',
      'translated  kubernetes-apps/HighErrorRate',
      '            -> error_rate > 5 over 5 min (service api)',
      '            Judged only with 20+ requests.',
      'unsupported kubernetes-apps/HostDiskLow',
      '            Host resource thresholds are not supported.',
      '',
      'Proposed rules are disabled until a person enables them.',
    ].join('\n'),
  )
})

test('input problems are shown, and an empty plan still reads sensibly', () => {
  const out = formatPlan({ groups: 0, recordingRules: 0, rules: [], totals: { translated: 0, approximate: 0, unsupported: 0 }, errors: ['Document 1 has no rule groups'], notes: [] })
  assert.equal(out.split('\n')[0], '0 alerting rules in 0 groups: 0 translated, 0 approximate, 0 unsupported')
  assert.match(out, /error: Document 1 has no rule groups/)
})

test('the token, not the ingest key, is what this command needs', () => {
  const ok = { api: 'https://api.example.com', token: TOKEN }
  assert.doesNotThrow(() => requireApiToken(ok))
  assert.doesNotThrow(() => requireApiToken({ api: 'http://localhost:4000', token: TOKEN }))
  assert.doesNotThrow(() => requireApiToken({ api: 'http://127.0.0.1:4000', token: TOKEN }))
  assert.throws(() => requireApiToken({ ...ok, api: '' }), /OWLPANE_API_URL is not set/)
  assert.throws(() => requireApiToken({ ...ok, token: undefined }), /OWLPANE_TOKEN is not set/)
  assert.throws(() => requireApiToken({ ...ok, token: 'owl_ing_secret' }), /owl_pat_.*Ingest keys are not accepted/)
  assert.throws(() => requireApiToken({ ...ok, api: 'http://api.example.com' }), /must use https/)
  assert.throws(() => requireApiToken({ ...ok, api: 'http://localhost.evil.com' }), /must use https/)
  assert.throws(() => requireApiToken({ ...ok, api: 'not a url' }), /not a valid URL/)
  assert.equal(config({ OWLPANE_TOKEN: ` ${TOKEN} ` }).token, TOKEN)
})

test('previewPrometheus posts the rules as JSON with the bearer token and returns the plan', async () => {
  let seen
  const fetchStub = async (url, init) => {
    seen = { url, init }
    return { ok: true, status: 200, json: async () => PLAN }
  }
  const plan = await previewPrometheus({ api: 'https://api.example.com', token: TOKEN }, 'groups: []', fetchStub)
  assert.equal(plan, PLAN)
  assert.equal(seen.url, 'https://api.example.com/v1/alerts/import/prometheus/preview')
  assert.equal(seen.init.method, 'POST')
  assert.equal(seen.init.headers.authorization, `Bearer ${TOKEN}`)
  assert.deepEqual(JSON.parse(seen.init.body), { rules: 'groups: []' })
})

test('a refusal from the server becomes an error with its message, even when the body is not JSON', async () => {
  const c = { api: 'https://api.example.com', token: TOKEN }
  const refuse = (status, body) => async () => ({ ok: false, status, json: async () => body })
  await assert.rejects(previewPrometheus(c, 'x', refuse(400, { message: 'Rules text is required' })), /preview failed: 400 Rules text is required/)
  await assert.rejects(previewPrometheus(c, 'x', refuse(401, {})), /preview failed: 401$/)
  await assert.rejects(previewPrometheus(c, 'x', async () => ({ ok: false, status: 502, json: async () => { throw new Error('html') } })), /preview failed: 502$/)
})

test('oversized rules are refused before anything is sent', async () => {
  let called = false
  await assert.rejects(previewPrometheus({ api: 'https://x', token: TOKEN }, 'a'.repeat(MAX_RULES_BYTES + 1), async () => { called = true }), /over 2 MB/)
  assert.equal(called, false)
})

/** Run the real binary with the given env and stdin; resolves with its output. */
function run(args, env, input) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, ...args], { env: { PATH: process.env.PATH, ...env } })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('close', (code) => resolve({ code, stdout, stderr }))
    child.stdin.end(input ?? '')
  })
}

test('end to end: rules piped on stdin reach the API with the token and print the preview', async () => {
  const requests = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (d) => (raw += d))
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: JSON.parse(raw) })
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(PLAN))
    })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const env = { OWLPANE_API_URL: `http://127.0.0.1:${server.address().port}`, OWLPANE_TOKEN: TOKEN, OWLPANE_INGEST_KEY: 'owl_ing_must_not_be_sent' }
  try {
    const text = await run(['alerts', 'import', 'prometheus', '-'], env, 'groups: []')
    assert.equal(text.code, 0, text.stderr)
    assert.match(text.stdout, /3 alerting rules in 1 group: 1 translated, 1 approximate, 1 unsupported/)
    assert.deepEqual(requests[0], { method: 'POST', url: '/v1/alerts/import/prometheus/preview', auth: `Bearer ${TOKEN}`, body: { rules: 'groups: []' } })

    const json = await run(['alerts', 'import', 'prometheus', '-', '--json'], env, 'groups: []')
    assert.deepEqual(JSON.parse(json.stdout), PLAN)
    assert.ok(requests.every((r) => !JSON.stringify(r).includes('owl_ing_')), 'the ingest key must never be sent')
  } finally {
    server.close()
  }
})

test('end to end: the wrong credential fails before any request is made', async () => {
  const r = await run(['alerts', 'import', 'prometheus', '-'], { OWLPANE_API_URL: 'https://api.example.com', OWLPANE_TOKEN: 'owl_ing_secret' }, 'x')
  assert.equal(r.code, 2)
  assert.match(r.stderr, /Ingest keys are not accepted/)
  const usage = await run(['alerts', 'import', 'grafana', 'f'], {}, '')
  assert.equal(usage.code, 2)
  assert.match(usage.stderr, /usage: owlpane alerts import prometheus/)
})
