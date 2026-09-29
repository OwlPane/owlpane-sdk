const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/([\w:.-]+)="([^"]*)"/g)].map((m) => [m[1], unesc(m[2])]))

/**
 * Reads JUnit XML (Jest, pytest, Maven Surefire, Go via gotestsum, RSpec…): every <testcase> becomes one result.
 * Deliberately dependency-free: the format is regular enough that a tag scan is exact for real reports.
 */
export function parseJunit(xml) {
  const out = []
  const suiteRe = /<testsuite\b([^>]*?)(\/>|>([\s\S]*?)<\/testsuite>)/g
  let s
  while ((s = suiteRe.exec(xml))) {
    const suite = attrsOf(s[1])
    const body = s[3] ?? ''
    const caseRe = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g
    let c
    while ((c = caseRe.exec(body))) {
      const a = attrsOf(c[1])
      const inner = c[3] ?? ''
      const failure = inner.match(/<(failure|error)\b([^>]*)/)
      const status = /<skipped\b/.test(inner) ? 'skip' : failure ? 'fail' : 'pass'
      out.push({
        suite: suite.name || a.classname || '(no suite)',
        name: a.name || '(unnamed)',
        classname: a.classname || '',
        status,
        seconds: Number(a.time) || 0,
        message: failure ? (attrsOf(failure[2]).message || '').slice(0, 300) : '',
      })
    }
  }
  return out
}
