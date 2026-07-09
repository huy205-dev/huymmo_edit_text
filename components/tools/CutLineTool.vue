<script setup lang="ts">
import { splitLines, joinLines } from '~/composables/useTextOps'

const toast = useToast()

type Mode = 'first' | 'last' | 'range' | 'skipFirst' | 'skipLast' | 'every'

const input = ref('')
const output = ref('')

const mode = ref<Mode>('first')
const n = ref(10)
const startPos = ref(1)
const endPos = ref(10)
const skipEmpty = ref(true)
const trimEach = ref(false)

const fileRef = ref<HTMLInputElement | null>(null)

const inLines = computed(() => {
  // Bỏ \n cuối cùng để paste có \n cuối không tạo ra dòng trống thừa
  let text = input.value.replace(/\r\n/g, '\n').replace(/\n+$/, '')
  let lines = text === '' ? [] : text.split('\n')
  if (trimEach.value) lines = lines.map((l) => l.trim())
  if (skipEmpty.value) lines = lines.filter((l) => l !== '')
  return lines
})

const outLines = computed<string[]>(() => {
  const lines = inLines.value
  const total = lines.length
  if (total === 0) return []
  const num = Math.max(0, Number(n.value) || 0)

  switch (mode.value) {
    case 'first':
      return num === 0 ? [] : lines.slice(0, num)
    case 'last':
      return num === 0 ? [] : lines.slice(-num)
    case 'skipFirst':
      return lines.slice(num)
    case 'skipLast':
      return num === 0 ? lines.slice() : lines.slice(0, Math.max(0, total - num))
    case 'range': {
      const a = Math.max(1, Math.min(total, Number(startPos.value) || 1))
      const b = Math.max(a, Math.min(total, Number(endPos.value) || a))
      return lines.slice(a - 1, b)
    }
    case 'every': {
      if (num <= 0) return lines.slice()
      return lines.filter((_, i) => i % num === 0)
    }
  }
})

watch(outLines, (v) => (output.value = joinLines(v)), { immediate: true })

const stats = computed(() => ({
  inCount: inLines.value.length,
  outCount: outLines.value.length,
  rawIn: input.value.length,
  rawOut: output.value.length
}))

const modeOptions: { value: Mode; label: string; help: string }[] = [
  { value: 'first',     label: 'N đầu',         help: 'Lấy N dòng đầu tiên' },
  { value: 'last',      label: 'N cuối',        help: 'Lấy N dòng cuối cùng' },
  { value: 'range',     label: 'Khoảng',        help: 'Lấy từ vị trí A đến vị trí B' },
  { value: 'skipFirst', label: 'Bỏ N đầu',      help: 'Bỏ N dòng đầu, lấy phần còn lại' },
  { value: 'skipLast',  label: 'Bỏ N cuối',     help: 'Bỏ N dòng cuối, lấy phần còn lại' },
  { value: 'every',     label: 'Mỗi N dòng',    help: 'Lấy 1 dòng mỗi N dòng (1, N+1, 2N+1...)' }
]
const currentHelp = computed(() => modeOptions.find((m) => m.value === mode.value)?.help)
const showRange = computed(() => mode.value === 'range')

async function paste() {
  try {
    input.value = await navigator.clipboard.readText()
    toast.add({ title: 'Đã dán nội dung', color: 'success', icon: 'i-lucide-clipboard' })
  } catch {
    toast.add({ title: 'Không truy cập được clipboard', color: 'error' })
  }
}
async function onFiles(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files?.length) return
  const texts = await Promise.all([...files].map((f) => f.text()))
  input.value = texts.join('\n')
  target.value = ''
}
function copyOutput() {
  if (!output.value) return toast.add({ title: 'Chưa có kết quả', color: 'warning' })
  navigator.clipboard.writeText(output.value)
  toast.add({ title: 'Đã copy', color: 'success', icon: 'i-lucide-copy-check' })
}
function downloadOutput() {
  if (!output.value) return
  const blob = new Blob([output.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'cut-line.txt'
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Options -->
    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
      <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        Chế độ cắt
      </div>

      <div class="flex flex-wrap gap-1.5 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800">
        <button
          v-for="m in modeOptions"
          :key="m.value"
          type="button"
          class="px-3 py-1.5 text-[12.5px] font-medium rounded-md transition-colors"
          :class="
            mode === m.value
              ? 'bg-white dark:bg-neutral-900 text-primary-700 dark:text-primary-300 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
          "
          @click="mode = m.value"
        >
          {{ m.label }}
        </button>
      </div>
      <div class="mt-2 text-[12px] text-neutral-500 dark:text-neutral-400">
        <UIcon name="i-lucide-info" class="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
        {{ currentHelp }}
      </div>

      <!-- Conditional inputs -->
      <div class="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <!-- N field (for first / last / skip / every) -->
        <div v-if="!showRange" class="flex flex-col gap-1.5">
          <label class="text-[12.5px] font-medium">Giá trị N</label>
          <UInput v-model.number="n" type="number" :min="0" size="md" />
        </div>

        <!-- Range fields (only for range mode) -->
        <template v-if="showRange">
          <div class="flex flex-col gap-1.5">
            <label class="text-[12.5px] font-medium">Vị trí bắt đầu</label>
            <UInput v-model.number="startPos" type="number" :min="1" size="md" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[12.5px] font-medium">Vị trí kết thúc</label>
            <UInput v-model.number="endPos" type="number" :min="1" size="md" />
          </div>
        </template>

        <label class="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 cursor-pointer">
          <span class="text-[12.5px]">Bỏ dòng trống</span>
          <USwitch v-model="skipEmpty" size="xs" />
        </label>
        <label class="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 cursor-pointer">
          <span class="text-[12.5px]">Trim mỗi dòng</span>
          <USwitch v-model="trimEach" size="xs" />
        </label>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 text-[12px] text-neutral-500 dark:text-neutral-400 font-mono">
        <span><strong class="text-neutral-700 dark:text-neutral-300">{{ stats.inCount }}</strong> dòng đầu vào</span>
        <UIcon name="i-lucide-arrow-right" class="w-3.5 h-3.5" />
        <span class="text-primary-700 dark:text-primary-400"><strong>{{ stats.outCount }}</strong> dòng kết quả</span>
      </div>
    </section>

    <!-- Input / Output -->
    <div class="grid gap-3 grid-cols-1 lg:grid-cols-2">
      <section class="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden min-h-[380px]">
        <div class="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60">
          <div class="flex items-center gap-2 text-[12.5px] font-semibold">
            <span class="w-2 h-2 rounded-full bg-blue-500" />
            Đầu vào
            <span class="ml-1 text-[11px] font-mono font-medium text-neutral-500 dark:text-neutral-400">{{ stats.inCount }} dòng</span>
          </div>
          <div class="flex items-center gap-1">
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-clipboard" @click="paste">Dán</UButton>
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-upload" @click="fileRef?.click()">File</UButton>
            <input ref="fileRef" type="file" multiple class="hidden" @change="onFiles" />
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-trash-2" square @click="input = ''" />
          </div>
        </div>
        <textarea
          v-model="input"
          spellcheck="false"
          placeholder="Dòng số 1
Dòng số 2
Dòng số 3
Dòng số 4
Dòng số 5
Dòng số 6
Dòng số 7
Dòng số 8
Dòng số 9
Dòng số 10"
          class="flex-1 resize-none border-0 outline-0 px-4 py-3.5 font-mono text-[13px] leading-relaxed bg-transparent"
        />
      </section>

      <section class="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden min-h-[380px]">
        <div class="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60">
          <div class="flex items-center gap-2 text-[12.5px] font-semibold">
            <span class="w-2 h-2 rounded-full bg-primary-500" />
            Kết quả
            <span class="ml-1 text-[11px] font-mono font-medium text-neutral-500 dark:text-neutral-400">{{ stats.outCount }} dòng</span>
          </div>
          <div class="flex items-center gap-1">
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-copy" @click="copyOutput">Copy</UButton>
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-download" square @click="downloadOutput" />
          </div>
        </div>
        <textarea
          v-model="output"
          spellcheck="false"
          readonly
          placeholder="Kết quả sẽ hiển thị tại đây..."
          class="flex-1 resize-none border-0 outline-0 px-4 py-3.5 font-mono text-[13px] leading-relaxed bg-transparent"
        />
      </section>
    </div>
  </div>
</template>
