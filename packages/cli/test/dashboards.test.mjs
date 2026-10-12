import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { describeWidget, formatDashboardPlan, MAX_DASHBOARD_BYTES, previewGrafana } from '../src/dashboards.mjs'

const BIN = fileURLToPath(new URL('../bin/owlpane.mjs', import.meta.url))
const TOKEN = 'owl_pat_abc123'

const widget = (spec, chart = 'line') => ({ title: 't', chart, spec: { groupBy: '', filters: [], ...spec } })

// the shape POST /v1/dashboards/import/grafana/preview returns (trimmed to the fields the CLI reads)
const PLAN = {
  dashboards: [
    {
      importKey: 'svc-overview',
      title: 'Service overview',
      totals: { translated: 1, approximate: 1, unsupported: 2 },
      panels: [
        { panelId: 1, panelTitle: 'Request rate', refId: 'A', status: 'approximate', widget: widget({ metric: 'http_requests_total', type: 'sum', agg: 'rate', groupBy: 'route', filters: [{ key: 'service', op: 'eq', value: '$service' }] }), notes: ["Grafana's interval variable was read as 5m."] },
        { panelId: 2, panelTitle: 'Goroutines', refId: 'A', status: 'translated', widget: widget({ metric: 'go_goroutines', type: 'gauge', agg: 'avg', filters: [{ key: 'service', op: 'eq', value: '$service' }] }), notes: ['Read as a gauge.'] },
        { panelId: 3, panelTitle: 'Latency', refId: 'A', status: 'unsupported', widget: null, notes: ['Histogram widgets cannot show quantiles.'] },
        { panelId: 3, panelTitle: 'Latency', refId: 'B', status: 'unsupported', widget: null, notes: ['The query is hidden in Grafana.'] },
      ],
    },
  ],
  totals: { translated: 1, approximate: 1, unsupported: 2 },
  errors: [],
  notes: ['Only Prometheus queries are translated.'],
}

test('a widget reads as one line: aggregation, metric, group-by, filters and chart', () => {
  assert.equal(describeWidget(PLAN.dashboards[0].panels[0].widget), 'rate http_requests_total by route where service = $service (line)')
  assert.equal(describeWidget(widget({ metric: 'go_goroutines', agg: 'avg' })), 'avg go_goroutines (line)')
  assert.equal(describeWidget(widget({ metric: 'm', agg: 'sum', filters: [{ key: 'a', op: 'eq', value: 'x' }, { key: 'status', op: 'neq', value: '200' }] }, 'bars')), 'sum m where a = x, status != 200 (bars)')
})

test('the plan prints per dashboard, with a query id only where a panel has several queries', () => {
  assert.equal(
    formatDashboardPlan(PLAN),
    [
      '1 dashboard, 4 panel queries: 1 translated, 1 approximate, 2 unsupported',
      '',
      'Service overview (svc-overview): 1 translated, 1 approximate, 2 unsupported',
      '  approximate Request rate',
      '              -> rate http_requests_total by route where service = $service (line)',
      "              Grafana's interval variable was read as 5m.",
      '  translated  Goroutines',
      '              -> avg go_goroutines where service = $service (line)',
      '              Read as a gauge.',
      '  unsupported Latency (A)',
      '              Histogram widgets cannot show quantiles.',
      '  unsupported Latency (B)',
      '              The query is hidden in Grafana.',
      '',
      'Only Prometheus queries are translated.',
    ].join('\n'),
  )
})

test('input problems are shown, and an empty plan still reads sensibly', () => {
  const out = formatDashboardPlan({ dashboards: [], totals: { translated: 0, approximate: 0, unsupported: 0 }, errors: ['Item has no panels'], notes: [] })
  assert.equal(out.split('\n')[0], '0 dashboards, 0 panel queries: 0 translated, 0 approximate, 0 unsupported')
  assert.match(out, /error: Item has no panels/)
})

test('previewGrafana posts the parsed JSON as `dashboards` with the bearer token', async () => {
  let seen
  const fetchStub = async (url, init) => {
    seen = { url, init }
    return { ok: true, status: 200, json: async () => PLAN }
  }
  const dash = { uid: 'abc', title: 'x', panels: [] }
  const plan = await previewGrafana({ api: 'https://api.example.com', token: TOKEN }, JSON.stringify(dash), fetchStub)
  assert.equal(plan, PLAN)
  assert.equal(seen.url, 'https://api.example.com/v1/dashboards/import/grafana/preview')
  assert.equal(seen.init.method, 'POST')
  assert.equal(seen.init.headers.authorization, `Bearer ${TOKEN}`)
  assert.deepEqual(JSON.parse(seen.init.body), { dashboards: dash })
})

test('bad input is refused before anything is sent, and server refusals keep their message', async () => {
  const c = { api: 'https://api.example.com', token: TOKEN }
  let called = false
  const spy = async () => {
    called = true
    return { ok: true, json: async () => ({}) }
  }
  await assert.rejects(previewGrafana(c, '{nope', spy), /not valid JSON/)
  await assert.rejects(previewGrafana(c, ' '.repeat(MAX_DASHBOARD_BYTES + 1), spy), /over 5 MB/)
  assert.equal(called, false)
  await assert.rejects(previewGrafana(c, '{}', async () => ({ ok: false, status: 400, json: async () => ({ message: 'Item has no panels' }) })), /preview failed: 400 Item has no panels/)
  await assert.rejects(previewGrafana(c, '{}', async () => ({ ok: false, status: 502, json: async () => { throw new Error('html') } })), /preview failed: 502$/)
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

test('end to end: a dashboard piped on stdin reaches the API with the token and prints the preview', async () => {
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
  const input = JSON.stringify({ dashboard: { uid: 'abc', title: 'x', panels: [] } })
  try {
    const text = await run(['dashboards', 'import', 'grafana', '-'], env, input)
    assert.equal(text.code, 0, text.stderr)
    assert.match(text.stdout, /1 dashboard, 4 panel queries: 1 translated, 1 approximate, 2 unsupported/)
    assert.deepEqual(requests[0], { method: 'POST', url: '/v1/dashboards/import/grafana/preview', auth: `Bearer ${TOKEN}`, body: { dashboards: JSON.parse(input) } })

    const json = await run(['dashboards', 'import', 'grafana', '-', '--json'], env, input)
    assert.deepEqual(JSON.parse(json.stdout), PLAN)
    assert.ok(requests.every((r) => !JSON.stringify(r).includes('owl_ing_')), 'the ingest key must never be sent')
  } finally {
    server.close()
  }
})

test('end to end: bad credentials, bad JSON and bad usage fail before any request', async () => {
  const ok = { OWLPANE_API_URL: 'https://api.example.com', OWLPANE_TOKEN: TOKEN }
  const wrong = await run(['dashboards', 'import', 'grafana', '-'], { ...ok, OWLPANE_TOKEN: 'owl_ing_secret' }, '{}')
  assert.equal(wrong.code, 2)
  assert.match(wrong.stderr, /Ingest keys are not accepted/)
  const notJson = await run(['dashboards', 'import', 'grafana', '-'], ok, '{nope')
  assert.equal(notJson.code, 2)
  assert.match(notJson.stderr, /not valid JSON/)
  const usage = await run(['dashboards', 'import', 'prometheus', 'f'], {}, '')
  assert.equal(usage.code, 2)
  assert.match(usage.stderr, /usage: owlpane dashboards import grafana/)
})
