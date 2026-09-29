/** Overall percentage plus per-file rows from lcov, Cobertura XML or Istanbul's json-summary. */
export function parseCoverage(format, text) {
  if (format === 'lcov') return lcov(text)
  if (format === 'cobertura') return cobertura(text)
  if (format === 'json-summary' || format === 'istanbul') return istanbul(text)
  throw new Error(`unknown coverage format "${format}" (lcov, cobertura, json-summary)`)
}

const pct = (covered, total) => (total > 0 ? Math.round((covered / total) * 10000) / 100 : 0)

function lcov(text) {
  const files = []
  let cur = null
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('SF:')) cur = { file: line.slice(3), total: 0, covered: 0 }
    else if (cur && line.startsWith('LF:')) cur.total = Number(line.slice(3)) || 0
    else if (cur && line.startsWith('LH:')) cur.covered = Number(line.slice(3)) || 0
    else if (line === 'end_of_record' && cur) {
      files.push({ ...cur, pct: pct(cur.covered, cur.total) })
      cur = null
    }
  }
  return summarize(files)
}

function cobertura(xml) {
  const files = []
  for (const m of xml.matchAll(/<class\b[^>]*?filename="([^"]+)"[^>]*?line-rate="([\d.]+)"[^>]*>([\s\S]*?)<\/class>/g)) {
    const lines = [...m[3].matchAll(/<line\b[^>]*?hits="(\d+)"/g)]
    const total = lines.length
    const covered = lines.filter((l) => Number(l[1]) > 0).length
    files.push({ file: m[1], total, covered, pct: total ? pct(covered, total) : Math.round(Number(m[2]) * 10000) / 100 })
  }
  return summarize(files)
}

function istanbul(text) {
  const doc = JSON.parse(text)
  const files = Object.entries(doc)
    .filter(([k]) => k !== 'total')
    .map(([file, v]) => ({ file, total: v.lines?.total ?? 0, covered: v.lines?.covered ?? 0, pct: v.lines?.pct ?? 0 }))
  const r = summarize(files)
  if (doc.total?.lines) return { ...r, pct: doc.total.lines.pct, total: doc.total.lines.total, covered: doc.total.lines.covered }
  return r
}

function summarize(files) {
  const total = files.reduce((n, f) => n + f.total, 0)
  const covered = files.reduce((n, f) => n + f.covered, 0)
  return { pct: pct(covered, total), total, covered, files }
}
