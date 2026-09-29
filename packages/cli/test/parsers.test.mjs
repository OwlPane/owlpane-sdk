import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectCi } from '../src/ci-env.mjs'
import { parseCoverage } from '../src/coverage.mjs'
import { parseJunit } from '../src/junit.mjs'

test('JUnit: pass, fail, error and skipped cases with their suites', () => {
  const xml = `<?xml version="1.0"?><testsuites>
    <testsuite name="checkout" tests="4"><testcase name="charges the card" classname="c" time="0.31"/>
      <testcase name="handles &quot;timeouts&quot;" time="1.8"><failure message="expected 200, got 504">stack…</failure></testcase>
      <testcase name="boom" time="0.01"><error message="TypeError: x"/></testcase>
      <testcase name="later" time="0"><skipped/></testcase></testsuite>
    <testsuite name="search"><testcase name="ranks exact" time="0.05"/></testsuite></testsuites>`
  const r = parseJunit(xml)
  assert.deepEqual(r.map((x) => x.status), ['pass', 'fail', 'fail', 'skip', 'pass'])
  assert.equal(r[1].name, 'handles "timeouts"')
  assert.equal(r[1].message, 'expected 200, got 504')
  assert.equal(r[4].suite, 'search')
  assert.equal(r[0].seconds, 0.31)
})

test('lcov: per-file and overall coverage', () => {
  const c = parseCoverage('lcov', 'SF:a.js\nLF:10\nLH:8\nend_of_record\nSF:b.js\nLF:10\nLH:2\nend_of_record\n')
  assert.equal(c.pct, 50)
  assert.deepEqual(c.files.map((f) => f.pct), [80, 20])
})

test('cobertura and istanbul json-summary', () => {
  const cob = parseCoverage('cobertura', '<coverage><packages><package><classes><class name="A" filename="src/a.py" line-rate="0.5"><lines><line number="1" hits="1"/><line number="2" hits="0"/></lines></class></classes></package></packages></coverage>')
  assert.equal(cob.files[0].pct, 50)
  const ist = parseCoverage('json-summary', JSON.stringify({ total: { lines: { total: 100, covered: 80, pct: 80 } }, 'src/x.ts': { lines: { total: 10, covered: 9, pct: 90 } } }))
  assert.equal(ist.pct, 80)
  assert.equal(ist.files.length, 1)
})

test('CI detection reads GitHub Actions variables', () => {
  const ci = detectCi({ GITHUB_ACTIONS: 'true', GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'o/r', GITHUB_SHA: 'abc', GITHUB_REF_NAME: 'main', GITHUB_RUN_ID: '9', GITHUB_WORKFLOW: 'ci' })
  assert.equal(ci.repo, 'https://github.com/o/r')
  assert.equal(ci.sha, 'abc')
  assert.equal(ci.runId, '9')
})
