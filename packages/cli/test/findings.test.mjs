import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { main } from '../src/main.mjs'

const file = join(mkdtempSync(join(tmpdir(), 'findings-')), 'report.sarif')
writeFileSync(file, '{}')
const base = { OWLPANE_INGEST_KEY: 'owl_ing_x', OWLPANE_API_URL: 'https://api.example.com' }

/** Run `findings import` with fetch stubbed; return the URL it called, what it logged and what it warned. */
async function run(args, env) {
  const real = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return { ok: true, status: 200, json: async () => ({ received: 1, created: 1, updated: 0, fixed: 0, skipped: 0 }) }
  }
  const out = []
  const warnings = []
  try {
    await main(['findings', 'import', 'sarif', file, ...args], { ...base, ...env }, (m) => out.push(m), (m) => warnings.push(m))
  } finally {
    globalThis.fetch = real
  }
  return { url: new URL(calls[0].url), auth: calls[0].init.headers.authorization, out, warnings }
}

test('--complete with no repository warns that it reaches the whole workspace, and still sends the import', async () => {
  const r = await run(['--complete'], {})
  assert.equal(r.warnings.length, 1)
  assert.match(r.warnings[0], /--complete without a repository .* whole workspace\. Pass --repo URL/)
  assert.equal(r.url.pathname, '/v1/findings/import/sarif')
  assert.equal(r.url.searchParams.get('complete'), '1')
  assert.equal(r.url.searchParams.get('repo'), '')
  assert.equal(r.auth, 'Bearer owl_ing_x')
  assert.match(r.out[0], /^imported 1 findings/)
})

test('no warning when the repository is given, or detected from the CI environment', async () => {
  const given = await run(['--complete', '--repo', 'https://github.com/o/r'], {})
  assert.deepEqual(given.warnings, [])
  assert.equal(given.url.searchParams.get('repo'), 'https://github.com/o/r')

  const ci = await run(['--complete'], { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'o/r' })
  assert.deepEqual(ci.warnings, [])
  assert.equal(ci.url.searchParams.get('repo'), 'https://github.com/o/r')
})

test('no warning when --complete is not used, even with no repository', async () => {
  const r = await run([], {})
  assert.deepEqual(r.warnings, [])
  assert.equal(r.url.searchParams.get('complete'), null)
})

test('--service and --kind are passed through, and the service is never guessed', async () => {
  const withBoth = await run(['--complete', '--repo', 'r', '--service', 'api', '--kind', 'code'], {})
  assert.equal(withBoth.url.searchParams.get('service'), 'api')
  assert.equal(withBoth.url.searchParams.get('kind'), 'code')
  const without = await run(['--repo', 'r'], { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'o/r', GITHUB_WORKFLOW: 'ci' })
  assert.equal(without.url.searchParams.get('service'), null)
})
