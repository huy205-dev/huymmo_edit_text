// Pure text helpers — used by all tools.

export const splitLines = (s: string): string[] =>
  s.length === 0 ? [] : s.split(/\r?\n/)
export const joinLines = (arr: string[]): string => arr.join('\n')

export const removeDiacritics = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')

export const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const unescapeSep = (s: string): string =>
  s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')

export function pickIndices<T>(arr: T[], spec: string): T[] {
  const expr = String(spec || '').trim()
  if (!expr) return arr
  const result: T[] = []
  expr.split(',').forEach((part) => {
    const p = part.trim()
    const m = p.match(/^(-?\d+)\s*-\s*(-?\d+)$/)
    if (m) {
      let a = parseInt(m[1])
      let b = parseInt(m[2])
      a = a < 0 ? arr.length + a : a - 1
      b = b < 0 ? arr.length + b : b - 1
      const [lo, hi] = a <= b ? [a, b] : [b, a]
      for (let i = lo; i <= hi; i++) if (arr[i] !== undefined) result.push(arr[i])
    } else {
      let i = parseInt(p)
      if (Number.isNaN(i)) return
      i = i < 0 ? arr.length + i : i - 1
      if (arr[i] !== undefined) result.push(arr[i])
    }
  })
  return result
}

export function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"'
        i++
      } else q = !q
    } else if (!q && line.startsWith(sep, i)) {
      out.push(cur)
      cur = ''
      i += sep.length - 1
    } else cur += c
  }
  out.push(cur)
  return out
}

export function sortKeys(v: any): any {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object')
    return Object.keys(v).sort().reduce((acc: any, k) => {
      acc[k] = sortKeys(v[k])
      return acc
    }, {})
  return v
}

export function flatten(v: any, prefix: string, out: Record<string, any>): void {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of Object.keys(v)) flatten(v[k], prefix ? `${prefix}.${k}` : k, out)
  } else if (Array.isArray(v)) {
    v.forEach((it, i) => flatten(it, `${prefix}[${i}]`, out))
  } else out[prefix] = v
}

export function parseCookies(input: string): [string, string][] {
  const text = input.replace(/\n/g, ';')
  return text
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map<[string, string]>((p) => {
      const i = p.indexOf('=')
      return i === -1 ? [p, ''] : [p.slice(0, i).trim(), p.slice(i + 1).trim()]
    })
}

export function extractFbUid(s: string): string {
  let m = s.match(/profile\.php\?id=(\d+)/)
  if (m) return m[1]
  m = s.match(/[?&](?:id|fbid|story_fbid)=(\d+)/)
  if (m) return m[1]
  m = s.match(/photo(?:\.php)?\/?\?.*fbid=(\d+)/)
  if (m) return m[1]
  m = s.match(/facebook\.com\/(\d{6,})\b/)
  if (m) return m[1]
  m = s.match(/(\d{8,})/)
  if (m) return m[1]
  return ''
}

export function guessFbYear(uid: string): string {
  const n = Number(uid)
  if (!Number.isFinite(n)) return '?'
  if (n < 1_000) return '2004'
  if (n < 700_000) return '2005'
  if (n < 12_000_000) return '2006'
  if (n < 60_000_000) return '2007'
  if (n < 300_000_000) return '2008'
  if (n < 1_000_000_000) return '2009-2010'
  if (n < 1_500_000_000) return '2010-2011'
  if (n < 2_500_000_000) return '2011-2012'
  if (n < 10_000_000_000) return '2013-2014'
  if (n < 100_000_000_000) return '2015-2017'
  return '2018+'
}

export function parseLooseNumber(s: string, parseShort: boolean): number {
  const m = String(s).trim().match(/-?\d[\d.,]*\s*[kmbKMB]?/)
  if (!m) return NaN
  let raw = m[0].replace(/\s/g, '')
  let mult = 1
  if (parseShort) {
    const last = raw.slice(-1).toLowerCase()
    if (last === 'k') {
      mult = 1e3
      raw = raw.slice(0, -1)
    } else if (last === 'm') {
      mult = 1e6
      raw = raw.slice(0, -1)
    } else if (last === 'b') {
      mult = 1e9
      raw = raw.slice(0, -1)
    }
  }
  if (raw.includes(',') && raw.includes('.')) {
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) raw = raw.replace(/\./g, '').replace(',', '.')
    else raw = raw.replace(/,/g, '')
  } else if (raw.includes(',')) {
    raw = raw.replace(/,/g, raw.split(',')[1]?.length === 3 ? '' : '.')
  }
  return parseFloat(raw) * mult
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(n)
}

// Word / sentence / paragraph counting (Vietnamese-aware)
export function analyzeText(s: string) {
  const trimmed = s.trim()
  const chars = s.length
  const charsNoSpace = s.replace(/\s/g, '').length
  const words = trimmed === '' ? 0 : trimmed.split(/\s+/).length
  const lines = s === '' ? 0 : splitLines(s).length
  const sentences = trimmed === '' ? 0 : (trimmed.match(/[^.!?…]+[.!?…]+/g) || [trimmed]).length
  const paragraphs = trimmed === '' ? 0 : trimmed.split(/\n\s*\n/).length
  // ~225 wpm reading, ~150 wpm speaking
  const readingSec = Math.ceil((words / 225) * 60)
  const speakingSec = Math.ceil((words / 150) * 60)
  return { chars, charsNoSpace, words, lines, sentences, paragraphs, readingSec, speakingSec }
}

// LCS-based diff for line arrays
export function diffLines(a: string[], b: string[]) {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: { type: 'eq' | 'add' | 'del'; text: string }[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'eq', text: a[i] })
      i++; j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i++] })
    } else {
      out.push({ type: 'add', text: b[j++] })
    }
  }
  while (i < n) out.push({ type: 'del', text: a[i++] })
  while (j < m) out.push({ type: 'add', text: b[j++] })
  return out
}

export function fmtSec(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m}m ${s}s` : `${m}m`
}
