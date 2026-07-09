<script setup lang="ts">
import { analyzeText, fmtSec, removeDiacritics } from '~/composables/useTextOps'

const text = ref('')
const toast = useToast()

const stats = computed(() => analyzeText(text.value))

const density = computed(() => {
  const words = text.value.toLocaleLowerCase('vi').match(/\p{L}+/gu) || []
  const stop = new Set(['và', 'là', 'của', 'có', 'cho', 'tới', 'trong', 'một', 'các', 'này', 'đó', 'đã', 'không', 'với', 'để', 'thì', 'nhưng', 'như', 'nên', 'từ', 'về', 'ra', 'lên', 'khi', 'sẽ', 'đang', 'rồi'])
  const counts = new Map<string, number>()
  for (const w of words) {
    if (w.length < 2) continue
    if (stop.has(w)) continue
    counts.set(w, (counts.get(w) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
})

function applyCase(mode: 'upper' | 'lower' | 'title' | 'sentence' | 'noDiacritics') {
  if (mode === 'upper') text.value = text.value.toLocaleUpperCase('vi')
  else if (mode === 'lower') text.value = text.value.toLocaleLowerCase('vi')
  else if (mode === 'title') text.value = text.value.toLocaleLowerCase('vi').replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('vi'))
  else if (mode === 'sentence') text.value = text.value.toLocaleLowerCase('vi').replace(/(^|[.!?]\s+)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('vi'))
  else if (mode === 'noDiacritics') text.value = removeDiacritics(text.value)
}
function removeExtraSpaces() {
  text.value = text.value.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}
function copy() {
  if (!text.value) return
  navigator.clipboard.writeText(text.value)
  toast.add({ title: 'Đã copy', color: 'success', icon: 'i-lucide-copy-check' })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2">
      <span class="text-[12px] font-medium text-neutral-500 ml-1">Case:</span>
      <UButton variant="ghost" color="neutral" size="xs" @click="applyCase('upper')">UPPERCASE</UButton>
      <UButton variant="ghost" color="neutral" size="xs" @click="applyCase('lower')">lowercase</UButton>
      <UButton variant="ghost" color="neutral" size="xs" @click="applyCase('title')">Title Case</UButton>
      <UButton variant="ghost" color="neutral" size="xs" @click="applyCase('sentence')">Sentence case</UButton>
      <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-eraser" @click="applyCase('noDiacritics')">Bỏ dấu</UButton>
      <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />
      <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-wind" @click="removeExtraSpaces">Bỏ khoảng trắng thừa</UButton>
      <div class="flex-1" />
      <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-copy" @click="copy">Copy</UButton>
      <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-trash-2" @click="text = ''">Clear</UButton>
    </div>

    <!-- Editor -->
    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      <div class="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-between">
        <div class="text-[12.5px] font-semibold">Word Counter</div>
        <div class="text-[12px] text-neutral-500 dark:text-neutral-400 font-mono">
          {{ stats.words.toLocaleString('vi-VN') }} từ · {{ stats.chars.toLocaleString('vi-VN') }} ký tự
        </div>
      </div>
      <textarea
        v-model="text"
        spellcheck="false"
        rows="10"
        placeholder="TextKit là bộ tiện ích chỉnh sửa text online miễn phí. Bạn có thể dán nội dung bài viết, email, hoặc bất kỳ đoạn văn nào để phân tích.

Công cụ sẽ đếm số từ, ký tự, câu, đoạn — đồng thời ước tính thời gian đọc và nói. Mật độ từ khóa cũng được phân tích để tối ưu SEO.

Toàn bộ xử lý chạy ngay trên trình duyệt, dữ liệu không gửi đi đâu cả."
        class="w-full resize-none border-0 outline-0 px-4 py-3.5 font-mono text-[13px] leading-relaxed bg-transparent min-h-[260px]"
      />
    </section>

    <!-- Stats -->
    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
      <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        Thống kê
      </div>
      <div class="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <div v-for="s in [
          { label: 'Từ', value: stats.words },
          { label: 'Ký tự', value: stats.chars },
          { label: 'Không dấu cách', value: stats.charsNoSpace },
          { label: 'Câu', value: stats.sentences },
          { label: 'Đoạn', value: stats.paragraphs },
          { label: 'Dòng', value: stats.lines }
        ]" :key="s.label" class="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 p-3">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{{ s.label }}</div>
          <div class="text-[20px] font-bold font-mono tabular-nums tracking-tight mt-1">{{ s.value.toLocaleString('vi-VN') }}</div>
        </div>
        <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 p-3">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Đọc</div>
          <div class="text-[20px] font-bold font-mono tabular-nums tracking-tight mt-1">{{ fmtSec(stats.readingSec) }}</div>
        </div>
        <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 p-3">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Nói</div>
          <div class="text-[20px] font-bold font-mono tabular-nums tracking-tight mt-1">{{ fmtSec(stats.speakingSec) }}</div>
        </div>
      </div>
    </section>

    <!-- Density -->
    <section v-if="density.length" class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
      <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        Mật độ từ khóa (top 12)
      </div>
      <div class="flex flex-wrap gap-1.5">
        <UBadge v-for="[w, c] in density" :key="w" color="neutral" variant="soft" size="md">
          <span class="font-medium">{{ w }}</span>
          <span class="ml-1.5 text-neutral-500 dark:text-neutral-400">×{{ c }}</span>
        </UBadge>
      </div>
    </section>
  </div>
</template>
