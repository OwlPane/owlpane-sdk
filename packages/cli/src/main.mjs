import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { config, requireKey } from './config.mjs'
import { detectCi } from './ci-env.mjs'
import { hex, sendSpans, span } from './otlp.mjs'
import { parseJunit } from './junit.mjs'
import { parseCoverage } from './coverage.mjs'

const HELP = `owlpane — send delivery and security data to Owlpane

  owlpane findings import <sarif|trivy|gitleaks|osv|cyclonedx|owlpane> <file> [--repo URL] [--service NAME] [--kind KIND] [--complete]
  owlpane ci run --pipeline NAME [--deploy ENV] [--commit-time ISO] -- <command…>
  owlpane ci report --pipeline NAME --result success|failure|cancelled [--duration-ms N] [--deploy ENV] [--commit-time ISO] [--rollback]
  owlpane test import junit <file> [--suite NAME]
  owlpane coverage import <lcov|cobertura|json-summary> <file>

Environment
  OWLPANE_INGEST_KEY   write-only ingest key (owl_ing_…)
  OWLPANE_INGEST_URL   OTLP ingest endpoint (CI runs, tests, coverage)
  OWLPANE_API_URL      API endpoint (security findings)
`

function flags(argv) {
  const pos = []
  const f = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') return { pos, f, rest: argv.slice(i + 1) }
    if (a.startsWith('--')) {
      const k = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) f[k] = true
      else {
        f[k] = next
        i++
      }
    } else pos.push(a)
  }
  return { pos, f, rest: [] }
}

const ciAttrs = (ci, extra = {}) => ({
  'cicd.system': ci.system,
  'vcs.repository.url.full': ci.repo,
  'vcs.ref.head.name': ci.branch,
  'vcs.ref.head.revision': ci.sha,
  ...extra,
})

export async function main(argv, env = process.env, log = console.log) {
  const [cmd, sub, ...tail] = argv
  const c = config(env)
  if (!cmd || cmd === 'help' || cmd === '--help') return log(HELP)

  if (cmd === 'findings' && sub === 'import') {
    const { pos, f } = flags(tail)
    const [format, file] = pos
    if (!format || !file) throw new Error('usage: owlpane findings import <format> <file>')
    requireKey(c)
    if (!c.api) throw new Error('OWLPANE_API_URL is not set.')
    const ci = detectCi(env)
    const q = new URLSearchParams({ repo: String(f.repo || ci.repo || ''), ...(f.service ? { service: String(f.service) } : {}), ...(f.kind ? { kind: String(f.kind) } : {}), ...(f.complete ? { complete: '1' } : {}) })
    const res = await fetch(`${c.api}/v1/findings/import/${format}?${q}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${c.key}` }, body: readFileSync(file) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`import failed: ${res.status} ${body.message ?? ''}`)
    return log(`imported ${body.received} findings: ${body.created} new, ${body.updated} updated, ${body.fixed} fixed, ${body.skipped} skipped`)
  }

  if (cmd === 'ci' && (sub === 'run' || sub === 'report')) {
    const { f, rest } = flags(tail)
    requireKey(c)
    const ci = detectCi(env)
    const pipeline = String(f.pipeline || ci.pipeline)
    if (!pipeline) throw new Error('--pipeline is required')
    let start = Date.now()
    let result = String(f.result || 'success')
    let durationMs = Number(f['duration-ms']) || 0
    let exit = 0
    if (sub === 'run') {
      if (!rest.length) throw new Error('give the command after --')
      const code = await new Promise((resolve) => spawn(rest[0], rest.slice(1), { stdio: 'inherit', shell: false }).on('exit', (x) => resolve(x ?? 1)).on('error', () => resolve(127)))
      exit = code
      result = code === 0 ? 'success' : 'failure'
      durationMs = Date.now() - start
    } else {
      start = Date.now() - durationMs
    }
    const commitTs = f['commit-time'] ? Date.parse(String(f['commit-time'])) : undefined
    const s = span({
      traceId: hex(16),
      name: `pipeline ${pipeline}`,
      start,
      end: start + durationMs,
      error: result === 'failure' ? 'pipeline failed' : undefined,
      attributes: ciAttrs(ci, {
        'cicd.pipeline.name': pipeline,
        'cicd.pipeline.run.id': ci.runId,
        'cicd.pipeline.result': result,
        'vcs.commit.timestamp': Number.isFinite(commitTs) ? commitTs : undefined,
        'owlpane.deploy.environment': f.deploy ? String(f.deploy) : undefined,
        'owlpane.deploy.rollback': f.rollback ? true : undefined,
      }),
    })
    await sendSpans(c, ci.system === 'local' ? 'ci' : ci.system, [s])
    log(`reported pipeline ${pipeline}: ${result} in ${Math.round(durationMs / 1000)} s`)
    return exit
  }

  if (cmd === 'test' && sub === 'import') {
    const { pos, f } = flags(tail)
    const [format, file] = pos
    if (format !== 'junit' || !file) throw new Error('usage: owlpane test import junit <file>')
    requireKey(c)
    const ci = detectCi(env)
    const results = parseJunit(readFileSync(file, 'utf8'))
    const traceId = hex(16)
    const now = Date.now()
    const spans = results.map((r, i) =>
      span({
        traceId,
        name: `test ${r.name}`,
        start: now - 1000 + i,
        end: now - 1000 + i + Math.max(1, r.seconds * 1000),
        error: r.status === 'fail' ? r.message || 'test failed' : undefined,
        attributes: ciAttrs(ci, { 'test.suite.name': String(f.suite || r.suite), 'test.case.name': r.name, 'test.case.result.status': r.status }),
      }),
    )
    await sendSpans(c, ci.system === 'local' ? 'ci' : ci.system, spans)
    const fails = results.filter((r) => r.status === 'fail').length
    return log(`sent ${results.length} test results (${fails} failed)`)
  }

  if (cmd === 'coverage' && sub === 'import') {
    const { pos } = flags(tail)
    const [format, file] = pos
    if (!format || !file) throw new Error('usage: owlpane coverage import <lcov|cobertura|json-summary> <file>')
    requireKey(c)
    const ci = detectCi(env)
    const cov = parseCoverage(format, readFileSync(file, 'utf8'))
    const traceId = hex(16)
    const now = Date.now()
    const spans = [
      span({ traceId, name: 'coverage report', start: now, end: now + 1, attributes: ciAttrs(ci, { 'code.coverage': cov.pct, 'code.lines.total': cov.total, 'code.lines.covered': cov.covered }) }),
      ...cov.files.slice(0, 500).map((x) => span({ traceId, name: 'coverage file', start: now, end: now + 1, attributes: ciAttrs(ci, { 'code.coverage': x.pct, 'code.filepath': x.file, 'code.lines.total': x.total }) })),
    ]
    await sendSpans(c, ci.system === 'local' ? 'ci' : ci.system, spans)
    return log(`sent coverage ${cov.pct}% across ${cov.files.length} files`)
  }

  throw new Error(`unknown command. Try: owlpane help`)
}
