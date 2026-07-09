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

export type ToolGroupId =
  | 'core'
  | 'lines'
  | 'filter'
  | 'web'
  | 'data'
  | 'net'
  | 'extra'

export type Tool = {
  id: string
  name: string
  icon: string         // lucide icon name (e.g., 'i-lucide-pencil-line')
  group: ToolGroupId
  desc: string
  options?: Field[]
  custom?:
    | 'pomodoro' | 'diff' | 'word-counter' | 'cut-string' | 'cut-line' | 'duplicates' | 'spin-text'
    | 'totp' | 'my-ip' | 'mail-reader' | 'oauth-helper'
  /** Multi-line example shown as faded placeholder when input is empty. */
  example?: string
  /** Generic processor for input/output tools. */
  run?: (input: string, opt: Record<string, any>) => string
  /** Optional: handle uploaded files (for "merge files"). */
  onFiles?: (files: FileList, opt: Record<string, any>) => Promise<string>
}

export const GROUPS: { id: ToolGroupId; label: string }[] = [
  { id: 'core', label: 'Cơ bản' },
  { id: 'lines', label: 'Cắt & ghép dòng' },
  { id: 'filter', label: 'Lọc nội dung' },
  { id: 'web', label: 'HTML & Web' },
  { id: 'data', label: 'Encode & Dữ liệu' },
  { id: 'net', label: 'Mạng & Tài khoản' },
  { id: 'extra', label: 'Tiện ích khác' }
]

import {
  splitLines, joinLines, removeDiacritics, unescapeSep, pickIndices,
  parseCsvLine, sortKeys, flatten,
  parseLooseNumber, formatNumber
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
  {
    id: 'spin-text', group: 'extra', name: 'Spin Text', icon: 'i-lucide-shuffle',
    desc: 'Sinh hàng loạt biến thể nội dung từ mẫu chứa {lựa chọn 1|lựa chọn 2|...}. Hỗ trợ lồng nhau.',
    custom: 'spin-text'
  },
  {
    id: 'text-type', group: 'core', name: 'Loại text', icon: 'i-lucide-shapes',
    desc: 'Phân loại từng dòng: số, email, URL, SĐT — hoặc chỉ giữ đúng loại bạn cần.',
    example: `nguyen.an@gmail.com
0987654321
https://example.com/page
1234567890
Đây là một dòng text bình thường
+84-901-234-567
support@company.vn`,
    options: [
      { type: 'segment', key: 'pick', label: 'Giữ loại', value: 'all', items: [
        { value: 'all', label: 'Phân loại' },
        { value: 'email', label: 'Email' },
        { value: 'url', label: 'URL' },
        { value: 'number', label: 'Số' },
        { value: 'phoneVN', label: 'SĐT VN' }
      ]}
    ],
    run(input, opt) {
      const lines = splitLines(input)
      const tests: Record<string, (s: string) => boolean> = {
        email: (s) => /[\w.+-]+@[\w-]+\.[\w.-]+/.test(s),
        url: (s) => /https?:\/\/\S+/.test(s),
        number: (s) => /^-?\d+([.,]\d+)?$/.test(s.trim()),
        phoneVN: (s) => /(?:\+?84|0)(3|5|7|8|9)\d{8}/.test(s.replace(/\s/g, ''))
      }
      if (opt.pick === 'all') {
        return joinLines(lines.map((l) => {
          for (const [k, fn] of Object.entries(tests)) if (fn(l)) return `[${k}]\t${l}`
          return `[text]\t${l}`
        }))
      }
      const fn = tests[opt.pick]
      return joinLines(fn ? lines.filter(fn) : lines)
    }
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
    id: 'hash-text', group: 'data', name: 'Hash Text', icon: 'i-lucide-shield',
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
    id: 'mail-reader', group: 'net', name: 'Đọc Hotmail (Graph API)', icon: 'i-lucide-mail',
    desc: 'Đọc email Hotmail/Outlook qua Microsoft Graph API — dán access_token để xem inbox.',
    custom: 'mail-reader'
  },
  {
    id: 'oauth-helper', group: 'net', name: 'OAuth2 / JWT', icon: 'i-lucide-shield-check',
    desc: 'Decode JWT token, build URL OAuth2 authorize, gọi thử API có Bearer token.',
    custom: 'oauth-helper'
  },

  // ===== Extra =====
  {
    id: 'pomodoro', group: 'extra', name: 'Pomodoro', icon: 'i-lucide-timer',
    desc: 'Đồng hồ tập trung 25/5 phút với âm báo khi hết giờ.',
    custom: 'pomodoro'
  },
  {
    id: 'calc-sub', group: 'extra', name: 'Tính Sub', icon: 'i-lucide-calculator',
    desc: 'Tính tổng / trung bình / min-max các con số (subscriber, view, like) trên mỗi dòng.',
    example: `1.2k
3.5k
12,500
8.9k
2m
42,000
1,250,000`,
    options: [
      { type: 'segment', key: 'mode', label: 'Chế độ', value: 'sum', items: [
        { value: 'sum', label: 'Tổng' },
        { value: 'avg', label: 'Trung bình' },
        { value: 'minmax', label: 'Min/Max' }
      ]},
      { type: 'switch', key: 'parseShort', label: 'Hiểu k/m/b (1.2k = 1200)', value: true }
    ],
    run(input, opt) {
      const nums = splitLines(input).map((l) => parseLooseNumber(l, opt.parseShort)).filter((n) => Number.isFinite(n))
      if (nums.length === 0) return '0'
      const sum = nums.reduce((a, b) => a + b, 0)
      if (opt.mode === 'sum') return `Tổng: ${formatNumber(sum)}\nSố dòng: ${nums.length}`
      if (opt.mode === 'avg') return `Trung bình: ${formatNumber(sum / nums.length)}\nTổng: ${formatNumber(sum)}\nSố dòng: ${nums.length}`
      return `Min: ${formatNumber(Math.min(...nums))}\nMax: ${formatNumber(Math.max(...nums))}\nTổng: ${formatNumber(sum)}\nSố dòng: ${nums.length}`
    }
  }
]

export const useTools = () => {
  const all = TOOLS
  const grouped = GROUPS.map((g) => ({ ...g, tools: all.filter((t) => t.group === g.id) })).filter((g) => g.tools.length)
  const findById = (id: string) => all.find((t) => t.id === id)
  return { all, grouped, groups: GROUPS, findById }
}
