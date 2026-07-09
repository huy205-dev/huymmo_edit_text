<script setup lang="ts">
const toast = useToast()

type Mode = 'ai' | 'synonym' | 'cs1' | 'cs2' | 'cs12' | 'manual'

const input = ref('Xin chào [r2] chị, chúc anh chị một ngày tuyệt vời! [r1][r4]')
const spinTemplate = ref('')
const preview = ref('')

const mode = ref<Mode>('cs12')
const aiModel = ref('chatgpt-4o')
const rate = ref(100)
const previewCount = ref(5)

const inputEl = ref<HTMLTextAreaElement | null>(null)
const iconsOpen = ref(true)

// =============== Icon groups ===============
// Default icon sets used when expanding [r1], [r2], ... markers in the input.
const DEFAULT_ICONS: Record<string, string> = {
  r1:  '❤️ 💕 💖 💗 💝 💞 ❣️ 💘 💓 💟',
  r2:  '😀 😁 😄 😆 😊 😍 🥰 🤩 😘 🥳',
  r3:  '👍 👏 🙌 👌 ✌️ 🤝 🙏 💪',
  r4:  '🔥 ✨ ⭐ 💥 🎉 🎊 💫 ⚡',
  r5:  '🌸 🌺 🌷 🌹 🌻 🌼 💐 🌿',
  r6:  '👉 👇 ➡️ ⬇️ ⤵️ ☝️ 👆 📌',
  r7:  '🎁 🎈 🎊 🎉 🎀 🎂 🛍️ 🛒',
  r8:  '✅ ☑️ ✔️ ☀️ 🌟 💯 🆗 🎯',
  r9:  '💎 👑 🏆 🥇 🌈 🦄 ✨',
  r10: '🚀 ⚡ ⏰ 📣 📢 🔔 📞 💬'
}

const iconGroups = reactive<Record<string, string>>({ ...DEFAULT_ICONS })

function resetGroup(key: string) {
  iconGroups[key] = DEFAULT_ICONS[key] || ''
}
function resetAllGroups() {
  for (const k of Object.keys(DEFAULT_ICONS)) iconGroups[k] = DEFAULT_ICONS[k]
  toast.add({ title: 'Đã khôi phục bộ icon mặc định', color: 'success', icon: 'i-lucide-rotate-ccw' })
}

// Insert [rN] at the current cursor position of the input textarea.
function insertMarker(key: string) {
  const ta = inputEl.value
  const marker = `[${key}]`
  if (!ta) {
    input.value += marker
    return
  }
  const start = ta.selectionStart ?? input.value.length
  const end = ta.selectionEnd ?? input.value.length
  input.value = input.value.slice(0, start) + marker + input.value.slice(end)
  nextTick(() => {
    ta.focus()
    const pos = start + marker.length
    ta.setSelectionRange(pos, pos)
  })
}

// =============== Homoglyph maps ===============
const HOMOGLYPHS: Record<string, string> = {
  a: 'а', b: 'ƅ', c: 'с', d: 'ԁ', e: 'е', g: 'ɡ', h: 'һ', i: 'і', j: 'ј',
  k: 'κ', l: 'ӏ', m: 'м', n: 'ո', o: 'о', p: 'р', s: 'ѕ', t: 'т', u: 'υ',
  v: 'ν', w: 'ԝ', x: 'х', y: 'у',
  A: 'Α', B: 'Β', C: 'С', E: 'Ε', H: 'Η', I: 'Ι', J: 'Ј', K: 'Κ',
  M: 'Μ', N: 'Ν', O: 'Ο', P: 'Ρ', S: 'Ѕ', T: 'Τ', X: 'Χ', Y: 'Υ', Z: 'Ζ'
}

function isLetter(ch: string) {
  return /\p{L}/u.test(ch)
}

// =============== Synonyms (VN, common phrases) ===============
const SYNONYMS: Record<string, string[]> = {
  'xin chào': ['chào', 'hi', 'hello', 'kính chào'],
  'chào': ['xin chào', 'hi', 'hello'],
  'chúc': ['chúc cho', 'gửi đến'],
  'mong': ['hi vọng', 'ước', 'mong rằng'],
  'một': ['một', '1'],
  'ngày': ['hôm', 'buổi'],
  'tuyệt vời': ['tốt đẹp', 'tuyệt diệu', 'xuất sắc', 'rất tốt'],
  'tốt': ['hay', 'đẹp', 'ổn'],
  'đẹp': ['xinh', 'đẹp đẽ', 'lung linh'],
  'mua': ['đặt', 'sở hữu', 'rinh'],
  'rẻ': ['giá tốt', 'tiết kiệm', 'hời'],
  'ưu đãi': ['khuyến mãi', 'giảm giá', 'sale'],
  'sản phẩm': ['mặt hàng', 'món hàng'],
  'cảm ơn': ['xin cảm ơn', 'thanks', 'tks'],
  'bạn': ['anh', 'chị', 'bạn yêu', 'mọi người'],
  'anh chị': ['quý khách', 'mọi người', 'bà con'],
  'rất': ['vô cùng', 'cực kỳ', 'siêu'],
  'thích': ['mê', 'yêu', 'ưng'],
  'nhanh': ['lẹ', 'tốc độ', 'siêu tốc'],
  'mới': ['mới ra', 'mới nhất', 'mới toanh'],
  'free ship': ['miễn phí ship', 'miễn phí giao hàng', 'free vận chuyển'],
  'liên hệ': ['inbox', 'nhắn tin', 'gọi'],
  'ngay': ['liền', 'lập tức', 'ngay bây giờ'],
  'hôm nay': ['bữa nay', 'ngày hôm nay'],
  'thôi': ['nha', 'nhé', 'thôi nào']
}

function spinChar(ch: string, opts: string[]) {
  const set = new Set([ch, ...opts])
  set.delete('')
  if (set.size <= 1) return ch
  return `{${[...set].join('|')}}`
}

// =============== Spin generators ===============
function expandIconMarkers(text: string) {
  return text.replace(/\[(r\d+)\]/g, (m, key: string) => {
    const raw = iconGroups[key]
    if (!raw) return m
    const items = [...new Set(raw.split(/\s+/).filter(Boolean))]
    if (items.length === 0) return m
    if (items.length === 1) return items[0]
    return `{${items.join('|')}}`
  })
}

function buildCharsetTemplate(text: string, kind: 'cs1' | 'cs2' | 'cs12', percent: number) {
  // Process text but skip already-spun groups {…} so we don't double-wrap icons.
  const parts = text.split(/(\{[^{}]*\})/g)
  return parts.map((part) => {
    if (part.startsWith('{') && part.endsWith('}')) return part
    return [...part].map((ch) => {
      if (!isLetter(ch)) return ch
      if (Math.random() * 100 > percent) return ch
      const lower = ch.toLocaleLowerCase('vi')
      const upper = ch.toLocaleUpperCase('vi')
      const opts: string[] = []
      if (kind === 'cs1' || kind === 'cs12') {
        if (lower !== upper) opts.push(ch === lower ? upper : lower)
      }
      if (kind === 'cs2' || kind === 'cs12') {
        if (HOMOGLYPHS[ch]) opts.push(HOMOGLYPHS[ch])
      }
      return spinChar(ch, opts)
    }).join('')
  }).join('')
}

function buildSynonymTemplate(text: string, percent: number) {
  const keys = Object.keys(SYNONYMS).sort((a, b) => b.length - a.length)
  let result = text
  for (const k of keys) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(${escapeRe(k)})(?![\\p{L}\\p{N}])`, 'giu')
    result = result.replace(re, (match) => {
      if (Math.random() * 100 > percent) return match
      const syns = SYNONYMS[k.toLocaleLowerCase('vi')] || SYNONYMS[k] || []
      const set = new Set([match, ...syns])
      if (set.size <= 1) return match
      return `{${[...set].join('|')}}`
    })
  }
  return result
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// =============== Main pipeline ===============
function generateSpin() {
  if (mode.value === 'ai') {
    toast.add({
      title: 'Tính năng AI sắp ra mắt',
      description: 'Đang phát triển — vui lòng dùng các chế độ khác.',
      color: 'info',
      icon: 'i-lucide-sparkles'
    })
    return
  }
  const r = Math.max(0, Math.min(100, Number(rate.value) || 100))
  // Step 1: Always expand icon markers first so they survive subsequent steps
  let result = expandIconMarkers(input.value)
  // Step 2: Apply mode-specific spinning
  if (mode.value === 'synonym') result = buildSynonymTemplate(result, r)
  else if (mode.value === 'manual') {
    // keep as-is (icons + manual {a|b} only)
  } else result = buildCharsetTemplate(result, mode.value, r)
  spinTemplate.value = result
  preview.value = ''
}

// =============== Preview ===============
const SPIN_RE = /\{([^{}]+)\}/

function resolveOnce(text: string) {
  let s = text
  let safety = 5000
  while (SPIN_RE.test(s) && safety-- > 0) {
    s = s.replace(SPIN_RE, (_, inner: string) => {
      const opts = inner.split('|')
      return opts[Math.floor(Math.random() * opts.length)]
    })
  }
  return s
}

function showPreview() {
  if (!spinTemplate.value) {
    toast.add({ title: 'Chưa có nội dung spin — bấm "Tạo bài viết spin" trước', color: 'warning' })
    return
  }
  const n = Math.max(1, Math.min(50, Number(previewCount.value) || 1))
  const seen = new Set<string>()
  const lines: string[] = []
  let attempts = 0
  while (lines.length < n && attempts++ < n * 50) {
    const v = resolveOnce(spinTemplate.value)
    if (!seen.has(v)) {
      seen.add(v)
      lines.push(v)
    }
  }
  preview.value = lines.join('\n\n――――――――――――――――――――\n\n')
}

// =============== Helpers ===============
async function paste() {
  try {
    input.value = await navigator.clipboard.readText()
    toast.add({ title: 'Đã dán nội dung', color: 'success', icon: 'i-lucide-clipboard' })
  } catch {
    toast.add({ title: 'Không truy cập được clipboard', color: 'error' })
  }
}
function copyTemplate() {
  if (!spinTemplate.value) return
  navigator.clipboard.writeText(spinTemplate.value)
  toast.add({ title: 'Đã copy nội dung spin', color: 'success', icon: 'i-lucide-copy-check' })
}
function copyPreview() {
  if (!preview.value) return
  navigator.clipboard.writeText(preview.value)
  toast.add({ title: 'Đã copy preview', color: 'success', icon: 'i-lucide-copy-check' })
}

const radioOptions: { value: Mode; label: string; sub?: string; disabled?: boolean }[] = [
  { value: 'ai',      label: 'Sử dụng AI', sub: 'Sắp ra mắt', disabled: true },
  { value: 'synonym', label: 'Từ đồng nghĩa' },
  { value: 'cs1',     label: 'Bộ kí tự 1' },
  { value: 'cs2',     label: 'Bộ kí tự 2' },
  { value: 'cs12',    label: 'Bộ kí tự 1 + 2' },
  { value: 'manual',  label: 'Giữ nguyên' }
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Input -->
    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 lg:p-5">
      <div class="flex items-center justify-between mb-2">
        <label class="text-[14px] font-semibold">Nội dung:</label>
        <div class="flex items-center gap-1">
          <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-clipboard" @click="paste">Dán</UButton>
          <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-trash-2" square @click="input = ''" />
        </div>
      </div>
      <textarea
        ref="inputEl"
        v-model="input"
        rows="5"
        spellcheck="false"
        placeholder="Nhập nội dung. Có thể chèn [r1]…[r10] để spin icon."
        class="w-full resize-y border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 font-mono text-[13.5px] leading-relaxed bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
      />
    </section>

    <!-- Icon groups -->
    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      <button
        type="button"
        class="w-full flex items-center justify-between gap-2 px-4 lg:px-5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
        @click="iconsOpen = !iconsOpen"
      >
        <div class="flex items-center gap-2 text-left">
          <UIcon name="i-lucide-smile-plus" class="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <span class="font-semibold text-[14px]">Bộ icon spin</span>
          <span class="text-[12px] text-neutral-500 dark:text-neutral-400">
            — chèn <code class="px-1 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[11.5px]">[r1]</code>…<code class="px-1 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[11.5px]">[r10]</code> vào nội dung
          </span>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="iconsOpen"
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-rotate-ccw"
            @click.stop="resetAllGroups"
          >
            Mặc định
          </UButton>
          <UIcon
            :name="iconsOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="w-4 h-4 text-neutral-400"
          />
        </div>
      </button>

      <div v-if="iconsOpen" class="px-4 lg:px-5 pb-4 lg:pb-5 grid gap-2 grid-cols-1 lg:grid-cols-2 border-t border-neutral-200 dark:border-neutral-800 pt-3">
        <div
          v-for="key in Object.keys(DEFAULT_ICONS)"
          :key="key"
          class="flex items-center gap-2"
        >
          <UButton
            color="primary"
            variant="soft"
            size="xs"
            class="font-mono shrink-0 w-[58px] justify-center"
            @click="insertMarker(key)"
          >
            [{{ key }}]
          </UButton>
          <UInput
            v-model="iconGroups[key]"
            size="xs"
            class="flex-1"
            :ui="{ base: 'font-mono text-[14px]' }"
          />
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-rotate-ccw"
            square
            :title="`Khôi phục ${key}`"
            @click="resetGroup(key)"
          />
        </div>
      </div>
    </section>

    <!-- Action / mode row -->
    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 lg:p-5">
      <div class="flex flex-wrap items-center gap-3">
        <UButton color="primary" size="md" icon="i-lucide-shuffle" @click="generateSpin">
          Tạo bài viết spin
        </UButton>

        <div class="w-px h-7 bg-neutral-200 dark:bg-neutral-800 hidden lg:block" />

        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1 min-w-[260px]">
          <label
            v-for="opt in radioOptions"
            :key="opt.value"
            class="flex items-center gap-1.5 cursor-pointer text-[13px]"
            :class="opt.disabled ? 'opacity-50 cursor-not-allowed' : ''"
          >
            <input
              type="radio"
              name="spin-mode"
              :value="opt.value"
              :checked="mode === opt.value"
              :disabled="opt.disabled"
              class="w-4 h-4 accent-primary-600"
              @change="mode = opt.value"
            />
            <span>{{ opt.label }}</span>
            <USelect
              v-if="opt.value === 'ai' && mode === 'ai'"
              v-model="aiModel"
              :items="[
                { label: 'ChatGPT 4o', value: 'chatgpt-4o' },
                { label: 'Claude Sonnet', value: 'claude-sonnet' },
                { label: 'Gemini', value: 'gemini' }
              ]"
              size="xs"
            />
            <UBadge v-if="opt.sub" color="warning" variant="subtle" size="xs">{{ opt.sub }}</UBadge>
          </label>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-[13px] font-medium whitespace-nowrap">Tỉ lệ spin (%):</label>
          <UInput v-model.number="rate" type="number" :min="0" :max="100" size="sm" class="w-20" />
        </div>
      </div>
    </section>

    <!-- Spin output -->
    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 lg:p-5">
      <div class="flex items-center justify-between mb-2">
        <label class="text-[14px] font-semibold">Nội dung đã thêm spin random:</label>
        <div class="flex items-center gap-1">
          <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-copy" @click="copyTemplate">Copy</UButton>
          <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-trash-2" square @click="spinTemplate = ''" />
        </div>
      </div>
      <textarea
        v-model="spinTemplate"
        rows="6"
        spellcheck="false"
        placeholder="Bấm 'Tạo bài viết spin' — kết quả sẽ hiển thị ở đây dưới dạng {lựa chọn 1|lựa chọn 2|...}"
        class="w-full resize-y border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 font-mono text-[13px] leading-relaxed bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
      />
      <div class="mt-2 text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
        <UIcon name="i-lucide-info" class="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
        Bạn có thể chỉnh tay bài spin trên — chèn thêm <code class="px-1 rounded bg-neutral-100 dark:bg-neutral-800 font-mono">{lựa chọn 1|lựa chọn 2}</code> hoặc <code class="px-1 rounded bg-neutral-100 dark:bg-neutral-800 font-mono">[rN]</code> để mở rộng.
      </div>
    </section>

    <!-- Preview -->
    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 lg:p-5">
      <div class="flex flex-wrap items-center gap-3 mb-3">
        <UButton color="info" variant="solid" size="md" icon="i-lucide-eye" @click="showPreview">
          Xem trước
        </UButton>
        <div class="flex items-center gap-2">
          <label class="text-[13px] font-medium whitespace-nowrap">Số biến thể:</label>
          <UInput v-model.number="previewCount" type="number" :min="1" :max="50" size="sm" class="w-20" />
        </div>
        <div class="flex-1" />
        <UButton v-if="preview" variant="ghost" color="neutral" size="xs" icon="i-lucide-copy" @click="copyPreview">Copy preview</UButton>
      </div>
      <textarea
        v-model="preview"
        rows="6"
        spellcheck="false"
        readonly
        placeholder="Bấm 'Xem trước' để xem các biến thể ngẫu nhiên được sinh ra từ bài spin..."
        class="w-full resize-y border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 font-mono text-[13px] leading-relaxed bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
      />
    </section>
  </div>
</template>
