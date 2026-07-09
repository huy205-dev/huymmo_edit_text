// Tool registry — each tool is one URL slug.
// Custom tools render their own component instead of the generic input/output layout.

export type FieldBase = {
  key: string
  label: string
  help?: string
  value?: any
  placeholder?: string
}
export type FieldSwitch = FieldBase & { type: 'switch' }
export type FieldText = FieldBase & { type: 'text' }
export type FieldNumber = FieldBase & { type: 'number' }
export type FieldTextarea = FieldBase & { type: 'textarea' }
export type FieldSegment = FieldBase & {
  type: 'segment'
  items: { value: string; label: string }[]
}
export type FieldInfo = { type: 'info'; text: string }
export type Field =
  | FieldSwitch | FieldText | FieldNumber | FieldTextarea | FieldSegment | FieldInfo

export type SuperId = 'g1' | 'g2' | 'g3'
export type CategoryId = 'text' | 'dev' | 'netsec' | 'seo' | 'misc'

export type ToolGroupId =
  | 'core'
  | 'lines'
  | 'filter'
  | 'web'
  | 'data'
  | 'devtools'
  | 'net'
  | 'security'
  | 'network'
  | 'seo'
  | 'extra'

export type Tool = {
  id: string
  name: string
  icon: string         // lucide icon name (e.g., 'i-lucide-pencil-line')
  group: ToolGroupId
  desc: string
  options?: Field[]
  custom?:
    | 'diff' | 'word-counter' | 'cut-string' | 'cut-line' | 'duplicates'
    | 'totp' | 'my-ip' | 'mail-reader' | 'oauth-helper'
  /** Multi-line example shown as faded placeholder when input is empty. */
  example?: string
  /** Generic processor for input/output tools. */
  run?: (input: string, opt: Record<string, any>) => string
  /** Optional: handle uploaded files (for "merge files"). */
  onFiles?: (files: FileList, opt: Record<string, any>) => Promise<string>
}

// Cấp 1 — nhóm CHA (siêu danh mục). Con (category) thuộc về một super qua `parent`.
export const SUPERS: { id: SuperId; label: string; icon: string }[] = [
  { id: 'g1', label: 'Text & Developer', icon: 'i-lucide-file-code' },
  { id: 'g2', label: 'Network & Web', icon: 'i-lucide-globe' },
  { id: 'g3', label: 'Utilities', icon: 'i-lucide-sparkles' }
]

// Cấp 2 — danh mục CON. Cháu (group) thuộc về một category qua `parent`.
export const CATEGORIES: { id: CategoryId; label: string; icon: string; parent: SuperId }[] = [
  { id: 'text', label: 'Text', icon: 'i-lucide-type', parent: 'g1' },
  { id: 'dev', label: 'Developer', icon: 'i-lucide-code-2', parent: 'g1' },
  { id: 'netsec', label: 'Network & Security', icon: 'i-lucide-shield', parent: 'g2' },
  { id: 'seo', label: 'SEO & Web', icon: 'i-lucide-search', parent: 'g2' },
  { id: 'misc', label: 'Other', icon: 'i-lucide-more-horizontal', parent: 'g3' }
]

// Cấp 3 — nhóm CHÁU (chứa tool). Thứ tự quyết định thứ tự hiển thị trong mỗi category.
export const GROUPS: { id: ToolGroupId; label: string; parent: CategoryId }[] = [
  { id: 'core', label: 'Basic', parent: 'text' },
  { id: 'lines', label: 'Lines', parent: 'text' },
  { id: 'filter', label: 'Filter', parent: 'text' },
  { id: 'data', label: 'Encode & Data', parent: 'dev' },
  { id: 'devtools', label: 'Dev Tools', parent: 'dev' },
  { id: 'web', label: 'HTML & Web', parent: 'dev' },
  { id: 'net', label: 'Accounts', parent: 'netsec' },
  { id: 'security', label: 'Security', parent: 'netsec' },
  { id: 'network', label: 'Network', parent: 'netsec' },
  { id: 'seo', label: 'SEO', parent: 'seo' },
  { id: 'extra', label: 'Misc', parent: 'misc' }
]

import {
  splitLines, joinLines, removeDiacritics, unescapeSep, pickIndices,
  parseCsvLine, sortKeys, flatten
} from './useTextOps'

export const TOOLS: Tool[] = [
  // ===== Core =====
  {
    id: 'edit-text', group: 'core', name: 'Edit Text', icon: 'i-lucide-pencil-line',
    desc: 'Chuyển định dạng chữ: HOA, thường, Title, Sentence — bỏ dấu, slug, đảo dòng, gộp khoảng trắng.',
    example: `xin chào các bạn
Đây là dòng thứ HAI
THỬ NGHIỆM   các   chế độ
chuyển đổi định dạng tiếng Việt`,
    options: [
      { type: 'segment', key: 'mode', label: 'Chế độ', value: 'upper', items: [
        { value: 'upper', label: 'HOA' },
        { value: 'lower', label: 'thường' },
        { value: 'title', label: 'Title' },
        { value: 'sentence', label: 'Sentence' }
      ]},
      { type: 'switch', key: 'noDiacritics', label: 'Loại bỏ dấu tiếng Việt' },
      { type: 'switch', key: 'trim', label: 'Cắt khoảng trắng đầu/cuối', value: true },
      { type: 'switch', key: 'collapseSpace', label: 'Gộp khoảng trắng thừa' },
      { type: 'switch', key: 'reverseLines', label: 'Đảo thứ tự các dòng' }
    ],
    run(input, opt) {
      let lines = splitLines(input)
      if (opt.reverseLines) lines = lines.reverse()
      lines = lines.map((l) => {
        let s = l
        if (opt.trim) s = s.trim()
        if (opt.collapseSpace) s = s.replace(/\s+/g, ' ')
        if (opt.noDiacritics) s = removeDiacritics(s)
        if (opt.mode === 'upper') s = s.toLocaleUpperCase('vi')
        else if (opt.mode === 'lower') s = s.toLocaleLowerCase('vi')
        else if (opt.mode === 'title')
          s = s.toLocaleLowerCase('vi').replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('vi'))
        else if (opt.mode === 'sentence')
          s = s.toLocaleLowerCase('vi').replace(/(^|[.!?]\s+)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('vi'))
        return s
      })
      return joinLines(lines)
    }
  },
  {
    id: 'word-counter', group: 'core', name: 'Word Counter', icon: 'i-lucide-text',
    desc: 'Đếm từ, ký tự, câu, đoạn, thời gian đọc và mật độ từ khóa.',
    custom: 'word-counter'
  },
  {
    id: 'text-diff', group: 'core', name: 'Text Diff', icon: 'i-lucide-git-compare',
    desc: 'So sánh hai đoạn văn bản và highlight phần thêm / xóa.',
    custom: 'diff'
  },

  // ===== Lines =====
  {
    id: 'cut-string', group: 'lines', name: 'Cắt Chuỗi', icon: 'i-lucide-scissors',
    desc: 'Cắt mỗi dòng theo ký tự ngăn cách rồi lấy phần từ vị trí bắt đầu đến vị trí kết thúc, có thể bỏ qua một số vị trí.',
    custom: 'cut-string'
  },
  {
    id: 'cut-line', group: 'lines', name: 'Cắt Line', icon: 'i-lucide-ruler',
    desc: 'Giới hạn dòng theo nhiều chế độ: N đầu, N cuối, theo khoảng, bỏ N đầu/cuối, hoặc lấy mỗi N dòng.',
    custom: 'cut-line'
  },
  {
    id: 'merge-lines', group: 'lines', name: 'Ghép dòng', icon: 'i-lucide-link',
    desc: 'Gộp tất cả các dòng thành một (hoặc theo nhóm) với dấu phân tách.',
    example: `Apple
Banana
Cherry
Date
Elderberry
Fig
Grape`,
    options: [
      { type: 'text', key: 'sep', label: 'Dấu nối', value: ', ', help: 'Dùng \\n cho xuống dòng, \\t cho tab.' },
      { type: 'number', key: 'group', label: 'Số dòng/nhóm (0 = toàn bộ)', value: 0 },
      { type: 'switch', key: 'skipEmpty', label: 'Bỏ qua dòng trống', value: true }
    ],
    run(input, opt) {
      let lines = splitLines(input)
      if (opt.skipEmpty) lines = lines.filter((l) => l.trim() !== '')
      const sep = unescapeSep(opt.sep || '')
      const g = parseInt(opt.group) || 0
      if (g <= 0) return lines.join(sep)
      const out: string[] = []
      for (let i = 0; i < lines.length; i += g) out.push(lines.slice(i, i + g).join(sep))
      return joinLines(out)
    }
  },
  {
    id: 'chunk-lines', group: 'lines', name: 'Chia cắt dòng', icon: 'i-lucide-puzzle',
    desc: 'Tách một chuỗi dài thành nhiều dòng — theo ký tự hoặc theo độ dài.',
    example: `apple,banana,cherry,date,elderberry,fig,grape,honeydew,kiwi,lemon`,
    options: [
      { type: 'segment', key: 'mode', label: 'Chế độ', value: 'bySep', items: [
        { value: 'bySep', label: 'Theo ký tự' },
        { value: 'byLen', label: 'Theo độ dài' }
      ]},
      { type: 'text', key: 'sep', label: 'Ký tự tách', value: ',' },
      { type: 'number', key: 'len', label: 'Độ dài mỗi đoạn', value: 80 },
      { type: 'switch', key: 'trim', label: 'Trim mỗi phần', value: true }
    ],
    run(input, opt) {
      if (opt.mode === 'bySep') {
        const sep = unescapeSep(opt.sep || ',')
        let parts = input.split(sep)
        if (opt.trim) parts = parts.map((p) => p.trim())
        return joinLines(parts)
      }
      const len = Math.max(1, parseInt(opt.len) || 1)
      const out: string[] = []
      for (let i = 0; i < input.length; i += len) out.push(input.slice(i, i + len))
      return joinLines(out)
    }
  },
  {
    id: 'reverse-words', group: 'lines', name: 'Đảo từ', icon: 'i-lucide-rotate-ccw',
    desc: 'Đảo ngược thứ tự các từ trong từng dòng.',
    example: `Hello world this is a test
Một hai ba bốn năm sáu
Việt Nam là quê hương tôi`,
    options: [
      { type: 'text', key: 'sep', label: 'Ký tự tách từ', value: ' ' },
      { type: 'switch', key: 'reverseChar', label: 'Đảo từng ký tự thay vì từ' }
    ],
    run(input, opt) {
      return joinLines(splitLines(input).map((l) => {
        if (opt.reverseChar) return [...l].reverse().join('')
        const sep = unescapeSep(opt.sep || ' ')
        return l.split(sep).reverse().join(sep)
      }))
    }
  },
  {
    id: 'concat', group: 'lines', name: 'Ghép Chuỗi', icon: 'i-lucide-tag',
    desc: 'Thêm tiền tố / hậu tố vào mỗi dòng.',
    example: `Text1
Text2
Text3
Text4
Text5`,
    options: [
      { type: 'text', key: 'prefix', label: 'Tiền tố', value: '' },
      { type: 'text', key: 'suffix', label: 'Hậu tố', value: '' },
      { type: 'switch', key: 'skipEmpty', label: 'Bỏ qua dòng trống', value: true }
    ],
    run(input, opt) {
      const p = unescapeSep(opt.prefix || '')
      const s = unescapeSep(opt.suffix || '')
      return joinLines(splitLines(input).map((l) => (opt.skipEmpty && l === '' ? l : p + l + s)))
    }
  },
  {
    id: 'join-words', group: 'lines', name: 'Join chữ', icon: 'i-lucide-paperclip',
    desc: 'Ghép các từ rời thành chuỗi liền (slug, camelCase...).',
    example: `Việt   Nam   ơi   Việt   Nam`,
    options: [
      { type: 'text', key: 'sep', label: 'Ký tự nối', value: '' },
      { type: 'switch', key: 'lower', label: 'Chuyển thành chữ thường' },
      { type: 'switch', key: 'noDiacritics', label: 'Bỏ dấu' }
    ],
    run(input, opt) {
      let s = input
      if (opt.lower) s = s.toLocaleLowerCase('vi')
      if (opt.noDiacritics) s = removeDiacritics(s)
      const sep = unescapeSep(opt.sep || '')
      return s.split(/\s+/).filter(Boolean).join(sep)
    }
  },

  // ===== Filter =====
  {
    id: 'duplicates', group: 'filter', name: 'Trùng lặp', icon: 'i-lucide-copy',
    desc: 'So sánh hai danh sách A và B để lọc trùng — A trừ B, A giao B, A hợp B, hoặc thao tác trên một danh sách.',
    custom: 'duplicates'
  },
  {
    id: 'filter-string', group: 'filter', name: 'Lọc Chuỗi', icon: 'i-lucide-search',
    desc: 'Giữ hoặc loại bỏ các dòng chứa từ khóa (kể cả Regex).',
    example: `Apple - 50,000đ
Banana - 30,000đ
Mango ngon - 70,000đ
Apple Pie - 80,000đ
Cherry tươi - 60,000đ
Orange juice - 25,000đ`,
    options: [
      { type: 'textarea', key: 'keywords', label: 'Từ khóa (mỗi dòng một từ)', value: '' },
      { type: 'segment', key: 'action', label: 'Hành động', value: 'keep', items: [
        { value: 'keep', label: 'Giữ chứa' },
        { value: 'remove', label: 'Loại chứa' }
      ]},
      { type: 'segment', key: 'match', label: 'Khớp', value: 'any', items: [
        { value: 'any', label: 'Bất kỳ' },
        { value: 'all', label: 'Tất cả' },
        { value: 'regex', label: 'Regex' }
      ]},
      { type: 'switch', key: 'caseInsensitive', label: 'Không phân biệt hoa/thường', value: true }
    ],
    run(input, opt) {
      const lines = splitLines(input)
      const keys = (opt.keywords || '').split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean)
      if (keys.length === 0) return input
      const flags = opt.caseInsensitive ? 'i' : ''
      const test = (line: string) => {
        if (opt.match === 'regex') {
          try { return keys.some((k: string) => new RegExp(k, flags).test(line)) }
          catch { return false }
        }
        const l = opt.caseInsensitive ? line.toLocaleLowerCase('vi') : line
        const ks = keys.map((k: string) => (opt.caseInsensitive ? k.toLocaleLowerCase('vi') : k))
        return opt.match === 'all' ? ks.every((k: string) => l.includes(k)) : ks.some((k: string) => l.includes(k))
      }
      return joinLines(lines.filter((l) => (opt.action === 'keep' ? test(l) : !test(l))))
    }
  },
  {
    id: 'filter-chars', group: 'filter', name: 'Lọc Chữ', icon: 'i-lucide-filter',
    desc: 'Giữ hoặc loại bỏ các loại ký tự (chữ, số, dấu câu...).',
    example: `Tên: Nguyễn Văn A — SĐT: 0987-654-321
Email: a.nguyen@example.com (24 tuổi)
Số 12, Ngõ 5, Đường ABC, Hà Nội`,
    options: [
      { type: 'switch', key: 'letters', label: 'Giữ chữ cái', value: true },
      { type: 'switch', key: 'digits', label: 'Giữ chữ số', value: true },
      { type: 'switch', key: 'space', label: 'Giữ khoảng trắng', value: true },
      { type: 'switch', key: 'punct', label: 'Giữ dấu câu' },
      { type: 'text', key: 'extra', label: 'Giữ thêm ký tự', value: '', help: 'VD: -_@.' }
    ],
    run(input, opt) {
      const extra = opt.extra || ''
      return [...input].map((ch) => {
        if (opt.letters && /\p{L}/u.test(ch)) return ch
        if (opt.digits && /\p{N}/u.test(ch)) return ch
        if (opt.space && /\s/.test(ch)) return ch
        if (opt.punct && /\p{P}/u.test(ch)) return ch
        if (extra.includes(ch)) return ch
        return ''
      }).join('')
    }
  },

  // ===== Web/HTML =====
  {
    id: 'filter-tag', group: 'web', name: 'Lọc tag HTML', icon: 'i-lucide-code',
    desc: 'Giữ hoặc loại bỏ thẻ HTML, trích xuất nội dung text thuần.',
    example: `<article>
  <h1>Tiêu đề bài viết</h1>
  <p>Đây là <strong>đoạn văn</strong> mẫu có chứa <a href="/link">liên kết</a>.</p>
  <img src="/photo.jpg" alt="ảnh demo" />
</article>`,
    options: [
      { type: 'segment', key: 'mode', label: 'Chế độ', value: 'strip', items: [
        { value: 'strip', label: 'Bỏ tag' },
        { value: 'keepText', label: 'Lấy text' },
        { value: 'keepOnly', label: 'Giữ tag X' }
      ]},
      { type: 'text', key: 'tags', label: 'Tag (cách nhau dấu phẩy)', value: 'p,a,h1,h2', help: 'Chỉ áp dụng ở chế độ "Giữ tag X".' }
    ],
    run(input, opt) {
      if (opt.mode === 'strip') return input.replace(/<\/?[^>]+>/g, '')
      if (opt.mode === 'keepText') {
        if (typeof document === 'undefined') return input.replace(/<\/?[^>]+>/g, '')
        const div = document.createElement('div')
        div.innerHTML = input
        return div.textContent || ''
      }
      const tagsArr = (opt.tags || '').split(',').map((s: string) => s.trim()).filter(Boolean)
      if (tagsArr.length === 0) return input
      const re = new RegExp(`<\\/?(?!(?:${tagsArr.join('|')})\\b)[^>]+>`, 'gi')
      return input.replace(re, '')
    }
  },
  {
    id: 'html-images', group: 'web', name: 'Ảnh HTML', icon: 'i-lucide-image',
    desc: 'Trích xuất tất cả URL ảnh trong HTML (img src, srcset, background).',
    example: `<div class="gallery">
  <img src="https://cdn.example.com/photo-1.jpg" alt="ảnh 1" />
  <img src="/uploads/photo-2.png" alt="ảnh 2" />
  <picture>
    <source srcset="/img/big.webp 2x, /img/small.webp 1x" />
  </picture>
  <div style="background-image: url('https://example.com/bg.jpg')"></div>
</div>`,
    options: [
      { type: 'switch', key: 'unique', label: 'Loại bỏ trùng', value: true },
      { type: 'switch', key: 'absolute', label: 'Chỉ giữ URL tuyệt đối' }
    ],
    run(input, opt) {
      const urls: string[] = []
      const re = /<img[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi
      const reSrcSet = /\bsrcset\s*=\s*["']([^"']+)["']/gi
      const reBg = /background(?:-image)?\s*:\s*url\(["']?([^"')]+)/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(input))) urls.push(m[1])
      while ((m = reSrcSet.exec(input))) m[1].split(',').forEach((p) => urls.push(p.trim().split(/\s+/)[0]))
      while ((m = reBg.exec(input))) urls.push(m[1])
      let out = urls
      if (opt.absolute) out = out.filter((u) => /^https?:\/\//i.test(u))
      if (opt.unique) out = [...new Set(out)]
      return joinLines(out)
    }
  },
  {
    id: 'html-links', group: 'web', name: 'Link HTML', icon: 'i-lucide-link-2',
    desc: 'Trích xuất tất cả URL trong <a href> hoặc text thuần.',
    example: `<nav>
  <a href="/">Trang chủ</a>
  <a href="/products">Sản phẩm</a>
  <a href="https://blog.example.com/post-1">Blog</a>
  <a href="https://shopee.vn/store">Shopee</a>
</nav>`,
    options: [
      { type: 'switch', key: 'unique', label: 'Loại bỏ trùng', value: true },
      { type: 'switch', key: 'plainText', label: 'Tìm trong text thuần' },
      { type: 'text', key: 'contains', label: 'Chỉ giữ URL chứa', value: '' }
    ],
    run(input, opt) {
      const urls: string[] = []
      let m: RegExpExecArray | null
      if (opt.plainText) {
        const re = /https?:\/\/[^\s<>"']+/gi
        while ((m = re.exec(input))) urls.push(m[0])
      } else {
        const re = /<a[^>]*\bhref\s*=\s*["']([^"']+)["']/gi
        while ((m = re.exec(input))) urls.push(m[1])
      }
      let out = urls
      if (opt.contains) out = out.filter((u) => u.includes(opt.contains))
      if (opt.unique) out = [...new Set(out)]
      return joinLines(out)
    }
  },

  // ===== Encode & Hash =====
  {
    id: 'base64', group: 'data', name: 'Base64', icon: 'i-lucide-binary',
    desc: 'Encode / decode Base64 (hỗ trợ Unicode).',
    example: `Xin chào TextKit! 🎉
Đây là chuỗi mẫu để mã hóa Base64.`,
    options: [
      { type: 'segment', key: 'mode', label: 'Chế độ', value: 'encode', items: [
        { value: 'encode', label: 'Encode' },
        { value: 'decode', label: 'Decode' }
      ]},
      { type: 'switch', key: 'urlSafe', label: 'URL-safe (-, _ thay +, /)' }
    ],
    run(input, opt) {
      try {
        if (opt.mode === 'encode') {
          const bytes = new TextEncoder().encode(input)
          let bin = ''
          bytes.forEach((b) => (bin += String.fromCharCode(b)))
          let s = btoa(bin)
          if (opt.urlSafe) s = s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
          return s
        }
        let s = input.trim()
        if (opt.urlSafe) s = s.replace(/-/g, '+').replace(/_/g, '/')
        while (s.length % 4) s += '='
        const bin = atob(s)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        return new TextDecoder().decode(bytes)
      } catch (e: any) {
        return `❌ ${e.message}`
      }
    }
  },
  {
    id: 'url-encoder', group: 'data', name: 'URL Encode/Decode', icon: 'i-lucide-globe',
    desc: 'Mã hóa / giải mã URL (percent encoding).',
    example: `https://example.com/search?q=tiếng việt&page=1&sort=mới nhất`,
    options: [
      { type: 'segment', key: 'mode', label: 'Chế độ', value: 'encode', items: [
        { value: 'encode', label: 'Encode' },
        { value: 'decode', label: 'Decode' }
      ]},
      { type: 'switch', key: 'component', label: 'encodeURIComponent (mạnh hơn)', value: true }
    ],
    run(input, opt) {
      try {
        if (opt.mode === 'encode') return opt.component ? encodeURIComponent(input) : encodeURI(input)
        return opt.component ? decodeURIComponent(input) : decodeURI(input)
      } catch (e: any) {
        return `❌ ${e.message}`
      }
    }
  },
  {
    id: 'hash-text', group: 'security', name: 'Hash Text', icon: 'i-lucide-shield',
    desc: 'Sinh chuỗi băm SHA-1 / SHA-256 / SHA-384 / SHA-512 từ text.',
    example: `Hello World — TextKit demo`,
    options: [
      { type: 'segment', key: 'algo', label: 'Thuật toán', value: 'SHA-256', items: [
        { value: 'SHA-1', label: 'SHA-1' },
        { value: 'SHA-256', label: 'SHA-256' },
        { value: 'SHA-384', label: 'SHA-384' },
        { value: 'SHA-512', label: 'SHA-512' }
      ]},
      { type: 'info', text: 'Hash chạy bằng Web Crypto API ngay trên trình duyệt.' }
    ],
    run() { return '' } // hash needs async — handled in ToolPage
  },

  // ===== Data =====
  {
    id: 'csv', group: 'data', name: 'Lọc CSV', icon: 'i-lucide-table',
    desc: 'Chọn cột từ CSV/TSV. Hỗ trợ dấu phẩy, tab, hoặc tự chọn.',
    example: `Tên,Tuổi,Email,Thành phố
Nguyễn An,25,an@example.com,Hà Nội
Trần Bình,30,binh@example.com,Đà Nẵng
Phạm Cường,28,cuong@example.com,TP.HCM`,
    options: [
      { type: 'segment', key: 'sepIn', label: 'Dấu vào', value: ',', items: [
        { value: ',', label: ',' },
        { value: ';', label: ';' },
        { value: '\\t', label: 'Tab' },
        { value: '|', label: '|' }
      ]},
      { type: 'text', key: 'cols', label: 'Cột cần lấy', value: '1', help: 'VD: 1,3 hoặc 1-3.' },
      { type: 'text', key: 'sepOut', label: 'Dấu ra', value: ',' },
      { type: 'switch', key: 'skipHeader', label: 'Bỏ qua dòng tiêu đề' }
    ],
    run(input, opt) {
      const sepIn = unescapeSep(opt.sepIn || ',')
      const sepOut = unescapeSep(opt.sepOut || ',')
      let lines = splitLines(input)
      if (opt.skipHeader) lines = lines.slice(1)
      return joinLines(lines.map((line) => pickIndices(parseCsvLine(line, sepIn), opt.cols).join(sepOut)))
    }
  },
  {
    id: 'json', group: 'data', name: 'JSON', icon: 'i-lucide-braces',
    desc: 'Format / minify / sort keys / flatten JSON.',
    example: `{"name":"Nguyễn An","age":25,"address":{"city":"Hà Nội","district":"Cầu Giấy"},"hobbies":["đọc sách","du lịch","cà phê"]}`,
    options: [
      { type: 'segment', key: 'mode', label: 'Chế độ', value: 'format', items: [
        { value: 'format', label: 'Format' },
        { value: 'minify', label: 'Minify' },
        { value: 'sort', label: 'Sort keys' },
        { value: 'flat', label: 'Flatten' }
      ]},
      { type: 'number', key: 'indent', label: 'Indent (format)', value: 2 }
    ],
    run(input, opt) {
      try {
        const data = JSON.parse(input)
        if (opt.mode === 'minify') return JSON.stringify(data)
        if (opt.mode === 'sort') return JSON.stringify(sortKeys(data), null, parseInt(opt.indent) || 2)
        if (opt.mode === 'flat') {
          const flat: Record<string, any> = {}
          flatten(data, '', flat)
          return JSON.stringify(flat, null, parseInt(opt.indent) || 2)
        }
        return JSON.stringify(data, null, parseInt(opt.indent) || 2)
      } catch (e: any) {
        return `❌ JSON không hợp lệ: ${e.message}`
      }
    }
  },
  {
    id: 'merge-files', group: 'data', name: 'Ghép file', icon: 'i-lucide-folder-plus',
    desc: 'Tải nhiều file text lên và ghép thành một.',
    options: [
      { type: 'text', key: 'sep', label: 'Dấu phân tách giữa file', value: '\\n' },
      { type: 'switch', key: 'showName', label: 'Thêm tên file ở đầu mỗi đoạn' },
      { type: 'info', text: 'Bấm "File" ở khung Đầu vào, chọn nhiều file để ghép.' }
    ],
    run(input) { return input },
    async onFiles(files, opt) {
      const arr = await Promise.all(
        [...files].map((f) => f.text().then((t) => (opt.showName ? `=== ${f.name} ===\n` : '') + t))
      )
      return arr.join(unescapeSep(opt.sep || '\\n'))
    }
  },

  // ===== Net & Account =====
  {
    id: 'totp', group: 'net', name: 'Lấy 2FA', icon: 'i-lucide-key-round',
    desc: 'Sinh mã TOTP (6 số) từ secret 2FA Base32 — RFC 6238. Hỗ trợ nhiều tài khoản cùng lúc.',
    custom: 'totp'
  },
  {
    id: 'my-ip', group: 'net', name: 'What is my IP', icon: 'i-lucide-globe-2',
    desc: 'Hiển thị IP công khai, vị trí, ISP, ASN, timezone, trình duyệt và hệ điều hành.',
    custom: 'my-ip'
  },
{
    id: 'mail-reader', group: 'net', name: 'Đọc Hotmail', icon: 'i-lucide-mail',
    desc: 'Đọc email Hotmail/Outlook qua Microsoft Graph API.',
    custom: 'mail-reader'
  },
  {
    id: 'oauth-helper', group: 'net', name: 'OAuth2 / JWT', icon: 'i-lucide-shield-check',
    desc: 'Decode JWT token, build URL OAuth2 authorize, gọi thử API có Bearer token.',
    custom: 'oauth-helper'
  },


  // ===== Text: thêm =====
  {
    id: 'slug', group: 'core', name: 'Tạo Slug', icon: 'i-lucide-link',
    desc: 'Chuyển mỗi dòng thành slug URL thân thiện — bỏ dấu, thay khoảng trắng bằng gạch nối.',
    example: `Bài Viết Hướng Dẫn SEO 2024!
Tệp tin của tôi.PDF`,
    options: [
      { type: 'text', key: 'sep', label: 'Ký tự nối', value: '-' },
      { type: 'switch', key: 'lower', label: 'Chữ thường', value: true }
    ],
    run(input, opt) {
      const sep = opt.sep || '-'
      const esc = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return joinLines(splitLines(input).map((l) => {
        let s = removeDiacritics(l)
        if (opt.lower) s = s.toLowerCase()
        return s.replace(/[^a-zA-Z0-9]+/g, sep).replace(new RegExp(`^${esc}+|${esc}+$`, 'g'), '')
      }))
    }
  },
  {
    id: 'sort-lines', group: 'lines', name: 'Sắp xếp dòng', icon: 'i-lucide-arrow-down-a-z',
    desc: 'Sắp xếp các dòng: A-Z, Z-A, theo số, theo độ dài, hoặc ngẫu nhiên — kèm lọc trùng.',
    example: `Cherry
Apple
Banana
Apple
Date`,
    options: [
      { type: 'segment', key: 'mode', label: 'Kiểu', value: 'asc', items: [
        { value: 'asc', label: 'A-Z' }, { value: 'desc', label: 'Z-A' },
        { value: 'num', label: 'Số' }, { value: 'len', label: 'Độ dài' }, { value: 'shuffle', label: 'Ngẫu nhiên' }
      ]},
      { type: 'switch', key: 'unique', label: 'Loại dòng trùng' },
      { type: 'switch', key: 'ci', label: 'Không phân biệt hoa/thường', value: true },
      { type: 'switch', key: 'skipEmpty', label: 'Bỏ dòng trống', value: true }
    ],
    run(input, opt) {
      let lines = splitLines(input)
      if (opt.skipEmpty) lines = lines.filter((l) => l.trim() !== '')
      if (opt.unique) {
        const seen = new Set<string>()
        lines = lines.filter((l) => {
          const k = opt.ci ? l.toLowerCase() : l
          if (seen.has(k)) return false
          seen.add(k); return true
        })
      }
      const coll = new Intl.Collator('vi', { numeric: true, sensitivity: opt.ci ? 'base' : 'variant' })
      if (opt.mode === 'asc') lines.sort((a, b) => coll.compare(a, b))
      else if (opt.mode === 'desc') lines.sort((a, b) => coll.compare(b, a))
      else if (opt.mode === 'num') lines.sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0))
      else if (opt.mode === 'len') lines.sort((a, b) => a.length - b.length)
      else if (opt.mode === 'shuffle') {
        for (let i = lines.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[lines[i], lines[j]] = [lines[j], lines[i]]
        }
      }
      return joinLines(lines)
    }
  },
  {
    id: 'find-replace', group: 'filter', name: 'Tìm & Thay thế', icon: 'i-lucide-replace',
    desc: 'Tìm và thay thế văn bản — hỗ trợ Regex, phân biệt hoa/thường, khớp trọn từ.',
    example: `Xin chào Thế giới
Xin chào Việt Nam`,
    options: [
      { type: 'text', key: 'find', label: 'Tìm', value: '' },
      { type: 'text', key: 'replace', label: 'Thay bằng', value: '' },
      { type: 'switch', key: 'regex', label: 'Dùng Regex' },
      { type: 'switch', key: 'ci', label: 'Không phân biệt hoa/thường' },
      { type: 'switch', key: 'word', label: 'Khớp trọn từ' }
    ],
    run(input, opt) {
      if (!opt.find) return input
      const flags = 'g' + (opt.ci ? 'i' : '')
      try {
        let pat = opt.regex ? opt.find : opt.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        if (opt.word) pat = `\\b${pat}\\b`
        const rep = (opt.replace || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
        return input.replace(new RegExp(pat, flags), rep)
      } catch (e: any) {
        return `❌ Regex lỗi: ${e.message}`
      }
    }
  },
  {
    id: 'remove-empty', group: 'filter', name: 'Xóa dòng trống', icon: 'i-lucide-list-x',
    desc: 'Xóa các dòng trống / chỉ chứa khoảng trắng, hoặc gộp nhiều dòng trống liên tiếp thành một.',
    example: `Dòng 1


Dòng 2

Dòng 3`,
    options: [
      { type: 'segment', key: 'mode', label: 'Chế độ', value: 'all', items: [
        { value: 'all', label: 'Xóa hết' }, { value: 'collapse', label: 'Gộp còn 1' }
      ]},
      { type: 'switch', key: 'trimEach', label: 'Trim mỗi dòng' }
    ],
    run(input, opt) {
      let lines = splitLines(input)
      if (opt.trimEach) lines = lines.map((l) => l.trim())
      const isEmpty = (l: string) => l.trim() === ''
      if (opt.mode === 'all') return joinLines(lines.filter((l) => !isEmpty(l)))
      const out: string[] = []
      let prevEmpty = false
      for (const l of lines) {
        const e = isEmpty(l)
        if (e && prevEmpty) continue
        out.push(l); prevEmpty = e
      }
      return joinLines(out)
    }
  },

  // ===== Developer tools =====
  {
    id: 'uuid', group: 'devtools', name: 'UUID Generator', icon: 'i-lucide-fingerprint',
    desc: 'Sinh UUID v4 ngẫu nhiên — một hoặc nhiều cùng lúc.',
    options: [
      { type: 'number', key: 'count', label: 'Số lượng', value: 5 },
      { type: 'switch', key: 'upper', label: 'IN HOA' },
      { type: 'switch', key: 'noDash', label: 'Bỏ dấu gạch (-)' }
    ],
    run(_input, opt) {
      const gen = () =>
        (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0
              return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
            })
      const n = Math.max(1, Math.min(1000, parseInt(opt.count) || 1))
      const out: string[] = []
      for (let i = 0; i < n; i++) {
        let u = gen()
        if (opt.noDash) u = u.replace(/-/g, '')
        if (opt.upper) u = u.toUpperCase()
        out.push(u)
      }
      return out.join('\n')
    }
  },
  {
    id: 'timestamp', group: 'devtools', name: 'Unix Timestamp', icon: 'i-lucide-clock',
    desc: 'Chuyển đổi Unix timestamp ⇄ ngày giờ (mỗi dòng một giá trị).',
    example: `1700000000
2024-01-15 10:30:00`,
    options: [
      { type: 'segment', key: 'mode', label: 'Chế độ', value: 'toDate', items: [
        { value: 'toDate', label: 'TS → Ngày' }, { value: 'toTs', label: 'Ngày → TS' }
      ]},
      { type: 'switch', key: 'ms', label: 'Đơn vị mili-giây (ms)' },
      { type: 'switch', key: 'utc', label: 'Hiển thị theo UTC' }
    ],
    run(input, opt) {
      return splitLines(input).filter((l) => l.trim()).map((l) => {
        const s = l.trim()
        if (opt.mode === 'toDate') {
          const n = Number(s)
          if (!Number.isFinite(n)) return `${s} → ❌`
          const d = new Date(opt.ms ? n : n * 1000)
          return opt.utc ? d.toUTCString() : d.toLocaleString('vi-VN')
        }
        const d = new Date(s)
        if (isNaN(d.getTime())) return `${s} → ❌`
        return String(opt.ms ? d.getTime() : Math.floor(d.getTime() / 1000))
      }).join('\n')
    }
  },
  {
    id: 'cron', group: 'devtools', name: 'Giải thích Cron', icon: 'i-lucide-calendar-clock',
    desc: 'Diễn giải biểu thức cron 5 trường (phút giờ ngày tháng thứ) sang tiếng Việt.',
    example: `*/15 0 * * 1-5`,
    run(input) {
      const line = (splitLines(input).find((l) => l.trim()) || '').trim()
      if (!line) return ''
      const parts = line.split(/\s+/)
      if (parts.length < 5) return '❌ Cron cần 5 trường: phút giờ ngày tháng thứ'
      const names = ['Phút (0-59)', 'Giờ (0-23)', 'Ngày trong tháng (1-31)', 'Tháng (1-12)', 'Thứ (0-6, 0=CN)']
      const describe = (v: string) =>
        v === '*' ? 'mọi giá trị'
          : v.includes('/') ? `mỗi ${v.split('/')[1]} đơn vị`
          : v.includes('-') ? `từ ${v.replace('-', ' đến ')}`
          : v.includes(',') ? `các giá trị ${v}`
          : `đúng lúc = ${v}`
      return names.map((n, i) => `${n}: ${parts[i]}  →  ${describe(parts[i])}`).join('\n')
    }
  },
  {
    id: 'regex-tester', group: 'devtools', name: 'Regex Tester', icon: 'i-lucide-regex',
    desc: 'Kiểm tra biểu thức chính quy trên văn bản — liệt kê match, nhóm bắt, hoặc đếm.',
    example: `Liên hệ: an@example.com, binh@test.vn
SĐT: 0987654321`,
    options: [
      { type: 'text', key: 'pattern', label: 'Pattern', value: '[\\w.]+@[\\w.]+' },
      { type: 'text', key: 'flags', label: 'Flags', value: 'g', help: 'VD: g, i, m, s' },
      { type: 'segment', key: 'out', label: 'Kết quả', value: 'matches', items: [
        { value: 'matches', label: 'Match' }, { value: 'groups', label: 'Nhóm' }, { value: 'count', label: 'Đếm' }
      ]}
    ],
    run(input, opt) {
      if (!opt.pattern) return ''
      let flags = opt.flags || ''
      if (!flags.includes('g')) flags += 'g'
      let re: RegExp
      try { re = new RegExp(opt.pattern, flags) } catch (e: any) { return `❌ Regex lỗi: ${e.message}` }
      const ms = [...input.matchAll(re)]
      if (opt.out === 'count') return `${ms.length} match`
      if (opt.out === 'groups') return ms.map((m) => m.slice(1).join(' | ') || '(không có nhóm bắt)').join('\n')
      return ms.map((m) => m[0]).join('\n')
    }
  },
  {
    id: 'numbase', group: 'devtools', name: 'Đổi cơ số', icon: 'i-lucide-arrow-right-left',
    desc: 'Chuyển số giữa hệ nhị phân, bát phân, thập phân, thập lục phân (mỗi dòng một số).',
    example: `255
1010`,
    options: [
      { type: 'segment', key: 'from', label: 'Từ hệ', value: '10', items: [
        { value: '2', label: '2' }, { value: '8', label: '8' }, { value: '10', label: '10' }, { value: '16', label: '16' }
      ]},
      { type: 'segment', key: 'to', label: 'Sang hệ', value: '16', items: [
        { value: '2', label: '2' }, { value: '8', label: '8' }, { value: '10', label: '10' }, { value: '16', label: '16' }
      ]},
      { type: 'switch', key: 'prefix', label: 'Thêm tiền tố (0x, 0b, 0o)' }
    ],
    run(input, opt) {
      const from = parseInt(opt.from), to = parseInt(opt.to)
      return splitLines(input).filter((l) => l.trim()).map((l) => {
        const s = l.trim().replace(/^0x/i, '').replace(/^0b/i, '').replace(/^0o/i, '')
        const n = parseInt(s, from)
        if (isNaN(n)) return `${l} → ❌`
        let r = n.toString(to)
        if (to === 16) r = r.toUpperCase()
        if (opt.prefix) r = (to === 16 ? '0x' : to === 2 ? '0b' : to === 8 ? '0o' : '') + r
        return r
      }).join('\n')
    }
  },
  {
    id: 'case-convert', group: 'devtools', name: 'Đổi kiểu Case', icon: 'i-lucide-case-sensitive',
    desc: 'Chuyển mỗi dòng sang camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE.',
    example: `hello world example
Đây là một chuỗi mẫu`,
    options: [
      { type: 'segment', key: 'style', label: 'Kiểu', value: 'camel', items: [
        { value: 'camel', label: 'camel' }, { value: 'pascal', label: 'Pascal' },
        { value: 'snake', label: 'snake' }, { value: 'kebab', label: 'kebab' }, { value: 'constant', label: 'CONST' }
      ]},
      { type: 'switch', key: 'noDiacritics', label: 'Bỏ dấu tiếng Việt', value: true }
    ],
    run(input, opt) {
      return joinLines(splitLines(input).map((l) => {
        let s = opt.noDiacritics ? removeDiacritics(l) : l
        const words = (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
        if (!words.length) return ''
        const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)
        switch (opt.style) {
          case 'snake': return words.join('_')
          case 'kebab': return words.join('-')
          case 'constant': return words.join('_').toUpperCase()
          case 'pascal': return words.map(cap).join('')
          default: return words[0] + words.slice(1).map(cap).join('')
        }
      }))
    }
  },
  {
    id: 'html-entities', group: 'devtools', name: 'HTML Entities', icon: 'i-lucide-code-xml',
    desc: 'Mã hóa / giải mã ký tự đặc biệt HTML (&lt; &amp; &quot; ...).',
    example: `<div class="box">Giá < 100 & > 50</div>`,
    options: [
      { type: 'segment', key: 'mode', label: 'Chế độ', value: 'encode', items: [
        { value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }
      ]}
    ],
    run(input, opt) {
      if (opt.mode === 'encode') {
        const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
        return input.replace(/[&<>"']/g, (c) => map[c])
      }
      const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
      return input.replace(/&(#\d+|#x[0-9a-fA-F]+|\w+);/g, (m, e) => {
        if (e[0] === '#') {
          const n = (e[1] === 'x' || e[1] === 'X') ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
          return isNaN(n) ? m : String.fromCodePoint(n)
        }
        return named[e.toLowerCase()] ?? m
      })
    }
  },
  {
    id: 'char-inspector', group: 'devtools', name: 'Soi ký tự Unicode', icon: 'i-lucide-scan-text',
    desc: 'Phân tích từng ký tự: code point U+XXXX và mã thập phân.',
    example: `A à 中 🎉`,
    options: [
      { type: 'switch', key: 'skipSpace', label: 'Bỏ khoảng trắng' }
    ],
    run(input, opt) {
      const out: string[] = []
      for (const ch of input) {
        if (opt.skipSpace && /\s/.test(ch)) continue
        const cp = ch.codePointAt(0)!
        const shown = /\s/.test(ch) ? JSON.stringify(ch) : ch
        out.push(`${shown}\tU+${cp.toString(16).toUpperCase().padStart(4, '0')}\t${cp}`)
      }
      return out.join('\n')
    }
  },
  {
    id: 'lorem', group: 'devtools', name: 'Lorem Ipsum', icon: 'i-lucide-pilcrow',
    desc: 'Sinh văn bản Lorem Ipsum theo số đoạn / câu / từ.',
    options: [
      { type: 'segment', key: 'unit', label: 'Đơn vị', value: 'paragraphs', items: [
        { value: 'paragraphs', label: 'Đoạn' }, { value: 'sentences', label: 'Câu' }, { value: 'words', label: 'Từ' }
      ]},
      { type: 'number', key: 'count', label: 'Số lượng', value: 3 },
      { type: 'switch', key: 'startLorem', label: 'Bắt đầu "Lorem ipsum"', value: true }
    ],
    run(_input, opt) {
      const W = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure voluptate velit esse cillum'.split(' ')
      const rw = () => W[Math.floor(Math.random() * W.length)]
      const sentence = () => {
        const n = 6 + Math.floor(Math.random() * 8)
        const s = Array.from({ length: n }, rw).join(' ')
        return s.charAt(0).toUpperCase() + s.slice(1) + '.'
      }
      const para = () => Array.from({ length: 3 + Math.floor(Math.random() * 4) }, sentence).join(' ')
      const c = Math.max(1, Math.min(100, parseInt(opt.count) || 1))
      let out = ''
      if (opt.unit === 'words') out = Array.from({ length: c }, rw).join(' ')
      else if (opt.unit === 'sentences') out = Array.from({ length: c }, sentence).join(' ')
      else out = Array.from({ length: c }, para).join('\n\n')
      if (opt.startLorem && opt.unit !== 'words') out = out.replace(/^\S+\s\S+/, 'Lorem ipsum')
      return out
    }
  },

  // ===== Security =====
  {
    id: 'password-gen', group: 'security', name: 'Tạo mật khẩu', icon: 'i-lucide-key-square',
    desc: 'Sinh mật khẩu ngẫu nhiên mạnh bằng Web Crypto — tuỳ chỉnh độ dài & bộ ký tự.',
    options: [
      { type: 'number', key: 'length', label: 'Độ dài', value: 16 },
      { type: 'number', key: 'count', label: 'Số lượng', value: 5 },
      { type: 'switch', key: 'upper', label: 'Chữ HOA (A-Z)', value: true },
      { type: 'switch', key: 'lower', label: 'Chữ thường (a-z)', value: true },
      { type: 'switch', key: 'digits', label: 'Chữ số (0-9)', value: true },
      { type: 'switch', key: 'symbols', label: 'Ký tự đặc biệt', value: true },
      { type: 'switch', key: 'noAmbiguous', label: 'Bỏ ký tự dễ nhầm (0 O 1 l I)' }
    ],
    run(_input, opt) {
      let set = ''
      if (opt.upper) set += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      if (opt.lower) set += 'abcdefghijklmnopqrstuvwxyz'
      if (opt.digits) set += '0123456789'
      if (opt.symbols) set += '!@#$%^&*()-_=+[]{};:,.?'
      if (opt.noAmbiguous) set = set.replace(/[0O1lI]/g, '')
      if (!set) return '❌ Chọn ít nhất một bộ ký tự'
      const len = Math.max(4, Math.min(128, parseInt(opt.length) || 16))
      const cnt = Math.max(1, Math.min(100, parseInt(opt.count) || 1))
      const rand = (n: number) => {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n
        }
        return Math.floor(Math.random() * n)
      }
      const gen = () => Array.from({ length: len }, () => set[rand(set.length)]).join('')
      return Array.from({ length: cnt }, gen).join('\n')
    }
  },
  {
    id: 'password-strength', group: 'security', name: 'Độ mạnh mật khẩu', icon: 'i-lucide-shield-check',
    desc: 'Đánh giá độ mạnh mật khẩu (mỗi dòng một cái) — entropy ước lượng theo bit.',
    example: `123456
P@ssw0rd
correct-horse-battery-staple`,
    run(input) {
      return splitLines(input).filter((l) => l.length).map((pw) => {
        let pool = 0
        if (/[a-z]/.test(pw)) pool += 26
        if (/[A-Z]/.test(pw)) pool += 26
        if (/[0-9]/.test(pw)) pool += 10
        if (/[^a-zA-Z0-9]/.test(pw)) pool += 32
        const entropy = Math.round(pw.length * Math.log2(pool || 1))
        const label = entropy < 40 ? 'Yếu 🔴' : entropy < 60 ? 'Trung bình 🟠' : entropy < 80 ? 'Mạnh 🟢' : 'Rất mạnh 🟢🟢'
        return `${pw}\t${entropy} bit\t${label}`
      }).join('\n')
    }
  },

  // ===== Network =====
  {
    id: 'subnet', group: 'network', name: 'Subnet / CIDR', icon: 'i-lucide-network',
    desc: 'Tính subnet IPv4 từ CIDR: network, broadcast, netmask, dải host, số host khả dụng.',
    example: `192.168.1.10/24
10.0.0.0/16`,
    run(input) {
      const ipToInt = (ip: string) => ip.split('.').reduce((a, o) => ((a << 8) + (+o)) >>> 0, 0)
      const intToIp = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
      return splitLines(input).filter((l) => l.trim()).map((l) => {
        const m = l.trim().match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/)
        if (!m) return `${l} → ❌ (định dạng a.b.c.d/nn)`
        const bits = +m[2]
        if (bits < 0 || bits > 32) return `${l} → ❌ prefix phải 0-32`
        if (m[1].split('.').some((o) => +o > 255)) return `${l} → ❌ octet > 255`
        const ip = ipToInt(m[1])
        const mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0
        const net = (ip & mask) >>> 0
        const bc = (net | (~mask >>> 0)) >>> 0
        const hosts = bits >= 31 ? (bits === 32 ? 1 : 2) : bc - net - 1
        const first = bits >= 31 ? net : net + 1
        const last = bits >= 31 ? bc : bc - 1
        return `${m[1]}/${bits}
  Netmask:    ${intToIp(mask)}
  Network:    ${intToIp(net)}
  Broadcast:  ${intToIp(bc)}
  Host range: ${intToIp(first)} - ${intToIp(last)}
  Usable:     ${hosts.toLocaleString('vi-VN')} host`
      }).join('\n\n')
    }
  },
  {
    id: 'spf', group: 'network', name: 'SPF Generator', icon: 'i-lucide-mail-check',
    desc: 'Tạo bản ghi SPF (TXT) từ IP, include, MX/A cho phép gửi mail.',
    options: [
      { type: 'text', key: 'ip4', label: 'IPv4 (cách nhau dấu phẩy)', value: '', placeholder: '1.2.3.4, 5.6.7.0/24' },
      { type: 'text', key: 'includes', label: 'include: (domain, phẩy)', value: '', placeholder: '_spf.google.com' },
      { type: 'switch', key: 'mx', label: 'Cho phép MX' },
      { type: 'switch', key: 'a', label: 'Cho phép A' },
      { type: 'segment', key: 'all', label: 'Chính sách', value: '~all', items: [
        { value: '-all', label: '-all (fail)' }, { value: '~all', label: '~all (soft)' }, { value: '?all', label: '?all (neutral)' }
      ]}
    ],
    run(_input, opt) {
      const parts = ['v=spf1']
      if (opt.a) parts.push('a')
      if (opt.mx) parts.push('mx')
      ;(opt.ip4 || '').split(',').map((s: string) => s.trim()).filter(Boolean).forEach((ip: string) => parts.push('ip4:' + ip))
      ;(opt.includes || '').split(',').map((s: string) => s.trim()).filter(Boolean).forEach((d: string) => parts.push('include:' + d))
      parts.push(opt.all || '~all')
      return parts.join(' ')
    }
  },
  {
    id: 'dmarc', group: 'network', name: 'DMARC Generator', icon: 'i-lucide-shield-alert',
    desc: 'Tạo bản ghi DMARC (TXT) cho _dmarc.domain — chính sách & báo cáo.',
    options: [
      { type: 'segment', key: 'p', label: 'Chính sách', value: 'none', items: [
        { value: 'none', label: 'none' }, { value: 'quarantine', label: 'quarantine' }, { value: 'reject', label: 'reject' }
      ]},
      { type: 'text', key: 'rua', label: 'Báo cáo tổng hợp (rua)', value: '', placeholder: 'mailto:dmarc@domain.com' },
      { type: 'text', key: 'ruf', label: 'Báo cáo lỗi (ruf)', value: '', placeholder: 'mailto:forensic@domain.com' },
      { type: 'number', key: 'pct', label: '% áp dụng (pct)', value: 100 }
    ],
    run(_input, opt) {
      const parts = ['v=DMARC1', 'p=' + (opt.p || 'none')]
      if (opt.rua) parts.push('rua=' + opt.rua.trim())
      if (opt.ruf) parts.push('ruf=' + opt.ruf.trim())
      const pct = parseInt(opt.pct)
      if (Number.isFinite(pct) && pct !== 100) parts.push('pct=' + pct)
      return parts.join('; ')
    }
  },

  // ===== SEO =====
  {
    id: 'meta-tags', group: 'seo', name: 'Meta Tag Generator', icon: 'i-lucide-tags',
    desc: 'Tạo thẻ <meta> SEO cơ bản: title, description, keywords, robots, viewport.',
    options: [
      { type: 'text', key: 'title', label: 'Title', value: '' },
      { type: 'textarea', key: 'desc', label: 'Description', value: '' },
      { type: 'text', key: 'keywords', label: 'Keywords', value: '' },
      { type: 'text', key: 'author', label: 'Author', value: '' },
      { type: 'switch', key: 'noindex', label: 'noindex, nofollow' }
    ],
    run(_input, opt) {
      const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c])
      const out: string[] = []
      if (opt.title) out.push(`<title>${esc(opt.title)}</title>`)
      if (opt.desc) out.push(`<meta name="description" content="${esc(opt.desc)}">`)
      if (opt.keywords) out.push(`<meta name="keywords" content="${esc(opt.keywords)}">`)
      if (opt.author) out.push(`<meta name="author" content="${esc(opt.author)}">`)
      out.push(`<meta name="robots" content="${opt.noindex ? 'noindex, nofollow' : 'index, follow'}">`)
      out.push(`<meta name="viewport" content="width=device-width, initial-scale=1">`)
      return out.join('\n')
    }
  },
  {
    id: 'og-tags', group: 'seo', name: 'Open Graph Generator', icon: 'i-lucide-share-2',
    desc: 'Tạo thẻ Open Graph & Twitter Card cho chia sẻ mạng xã hội.',
    options: [
      { type: 'text', key: 'title', label: 'og:title', value: '' },
      { type: 'textarea', key: 'desc', label: 'og:description', value: '' },
      { type: 'text', key: 'url', label: 'og:url', value: '' },
      { type: 'text', key: 'image', label: 'og:image', value: '' },
      { type: 'text', key: 'type', label: 'og:type', value: 'website' },
      { type: 'switch', key: 'twitter', label: 'Thêm Twitter Card', value: true }
    ],
    run(_input, opt) {
      const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c])
      const out: string[] = []
      const og = (p: string, v: string) => { if (v) out.push(`<meta property="og:${p}" content="${esc(v)}">`) }
      og('title', opt.title); og('description', opt.desc); og('url', opt.url); og('image', opt.image); og('type', opt.type || 'website')
      if (opt.twitter) {
        out.push(`<meta name="twitter:card" content="${opt.image ? 'summary_large_image' : 'summary'}">`)
        if (opt.title) out.push(`<meta name="twitter:title" content="${esc(opt.title)}">`)
        if (opt.desc) out.push(`<meta name="twitter:description" content="${esc(opt.desc)}">`)
        if (opt.image) out.push(`<meta name="twitter:image" content="${esc(opt.image)}">`)
      }
      return out.join('\n')
    }
  },
  {
    id: 'robots', group: 'seo', name: 'robots.txt Generator', icon: 'i-lucide-bot',
    desc: 'Tạo nội dung robots.txt: cho phép / chặn crawler, khai báo sitemap.',
    options: [
      { type: 'segment', key: 'preset', label: 'Mẫu', value: 'allow', items: [
        { value: 'allow', label: 'Cho phép tất cả' }, { value: 'block', label: 'Chặn tất cả' }, { value: 'custom', label: 'Tuỳ chỉnh' }
      ]},
      { type: 'textarea', key: 'disallow', label: 'Disallow (mỗi dòng một path)', value: '/admin\n/private' },
      { type: 'text', key: 'sitemap', label: 'Sitemap URL', value: '' }
    ],
    run(_input, opt) {
      const out = ['User-agent: *']
      if (opt.preset === 'block') out.push('Disallow: /')
      else if (opt.preset === 'allow') out.push('Disallow:')
      else (opt.disallow || '').split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean).forEach((p: string) => out.push('Disallow: ' + p))
      if (opt.sitemap) out.push('', 'Sitemap: ' + opt.sitemap.trim())
      return out.join('\n')
    }
  },
  {
    id: 'keyword-density', group: 'seo', name: 'Mật độ từ khóa', icon: 'i-lucide-percent',
    desc: 'Phân tích tần suất & mật độ từ khóa trong văn bản (top N từ).',
    example: `SEO là quá trình tối ưu hóa website. Tối ưu hóa nội dung giúp SEO tốt hơn. SEO cần từ khóa phù hợp.`,
    options: [
      { type: 'number', key: 'top', label: 'Top N từ', value: 20 },
      { type: 'switch', key: 'noDiacritics', label: 'Bỏ dấu khi gộp' }
    ],
    run(input, opt) {
      let text = input.toLowerCase()
      if (opt.noDiacritics) text = removeDiacritics(text)
      const words = text.match(/[\p{L}\p{N}]+/gu) || []
      if (!words.length) return ''
      const stop = new Set(['và', 'là', 'của', 'có', 'cho', 'các', 'một', 'những', 'được', 'the', 'a', 'an', 'of', 'to', 'in', 'and', 'is', 'for'])
      const freq: Record<string, number> = {}
      words.forEach((w) => { if (w.length < 2 || stop.has(w)) return; freq[w] = (freq[w] || 0) + 1 })
      const total = words.length
      const top = Math.max(1, Math.min(200, parseInt(opt.top) || 20))
      return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, top)
        .map(([w, c]) => `${w}\t${c}\t${(c / total * 100).toFixed(2)}%`).join('\n')
    }
  }
]

export const useTools = () => {
  const all = TOOLS
  // Cây 3 cấp: super (cha) → category (con) → group (cháu) → tools. Bỏ nhánh rỗng.
  const tree = SUPERS.map((s) => ({
    ...s,
    categories: CATEGORIES.filter((c) => c.parent === s.id)
      .map((c) => ({
        ...c,
        groups: GROUPS.filter((g) => g.parent === c.id)
          .map((g) => ({ ...g, tools: all.filter((t) => t.group === g.id) }))
          .filter((g) => g.tools.length)
      }))
      .filter((c) => c.groups.length)
  })).filter((s) => s.categories.length)
  // Danh sách phẳng các nhóm cháu (đúng thứ tự cây) — dùng cho trang chủ.
  const grouped = tree.flatMap((s) => s.categories.flatMap((c) => c.groups))
  const findById = (id: string) => all.find((t) => t.id === id)
  return { all, tree, grouped, groups: GROUPS, categories: CATEGORIES, supers: SUPERS, findById }
}
