<script setup lang="ts">
import { splitLines, joinLines } from '~/composables/useTextOps'

const toast = useToast()

// Options
const delim = ref('|')
const skipPos = ref('')      // VD: "2,4" — vị trí bỏ qua không lấy
const startPos = ref(1)      // Vị trí bắt đầu cắt
const endPos = ref(1)        // Vị trí kết thúc cắt
const keepEmpty = ref(false) // Giữ dòng trống

// In/out
const input = ref('')
const output = ref('')
const fileRef = ref<HTMLInputElement | null>(null)

const skipSet = computed(() => {
  return new Set(
    String(skipPos.value || '')
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)
  )
})

function run() {
  try {
    const sep = delim.value || '|'
    const a = Math.max(1, Number(startPos.value) || 1)
    const b = Math.max(a, Number(endPos.value) || a)
    const skip = skipSet.value

    output.value = joinLines(
      splitLines(input.value)
        .map((line) => {
          const parts = line.split(sep)
          const picked: string[] = []
          for (let i = a; i <= b; i++) {
            if (skip.has(i)) continue
            const v = parts[i - 1]
            if (v !== undefined) picked.push(v)
          }
          return picked.join(sep)
        })
        .filter((l) => keepEmpty.value || l !== '')
    )
  } catch (e: any) {
    output.value = `❌ Lỗi: ${e.message}`
  }
}

let runTimer: ReturnType<typeof setTimeout> | null = null
watch(
  [input, delim, skipPos, startPos, endPos, keepEmpty],
  () => {
    if (runTimer) clearTimeout(runTimer)
    runTimer = setTimeout(run, 150)
  },
  { immediate: true }
)

const inCount = computed(() => fmt(input.value))
const outCount = computed(() => fmt(output.value))
function fmt(s: string) {
  const lines = s === '' ? 0 : splitLines(s).length
  return `${s.length.toLocaleString('vi-VN')} ký tự · ${lines.toLocaleString('vi-VN')} dòng`
}

async function paste() {
  try {
    input.value = await navigator.clipboard.readText()
    toast.add({ title: 'Đã dán nội dung', color: 'success', icon: 'i-lucide-clipboard' })
  } catch {
    toast.add({ title: 'Không truy cập được clipboard', color: 'error' })
  }
}
function copyOutput() {
  if (!output.value) {
    toast.add({ title: 'Chưa có nội dung để copy', color: 'warning' })
    return
  }
  navigator.clipboard
    .writeText(output.value)
    .then(() => toast.add({ title: 'Đã copy', color: 'success', icon: 'i-lucide-copy-check' }))
}
function downloadOutput() {
  if (!output.value) return
  const blob = new Blob([output.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'cut-string.txt'
  a.click()
  URL.revokeObjectURL(url)
}
async function onFiles(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files?.length) return
  const texts = await Promise.all([...files].map((f) => f.text()))
  input.value = texts.join('\n')
  target.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Options card — 2-column grid -->
    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 lg:p-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        <!-- Ký tự ngăn cách -->
        <div class="flex flex-col gap-2">
          <label class="text-[14px] font-medium text-neutral-800 dark:text-neutral-200">
            Ký tự ngăn cách:
          </label>
          <UInput
            v-model="delim"
            size="lg"
            placeholder="VD: | hoặc , hoặc \t"
            :ui="{ base: 'rounded-full' }"
          />
        </div>

        <!-- Bỏ qua vị trí -->
        <div class="flex flex-col gap-2">
          <label class="text-[14px] font-medium text-neutral-800 dark:text-neutral-200">
            Bỏ qua Vị trí số:
          </label>
          <UInput
            v-model="skipPos"
            size="lg"
            placeholder="Vị trí Bỏ qua không muốn Cắt"
            :ui="{ base: 'rounded-full' }"
          />
        </div>

        <!-- Vị trí bắt đầu -->
        <div class="flex flex-col gap-2">
          <label class="text-[14px] font-medium text-neutral-800 dark:text-neutral-200">
            Vị trí Bắt đầu Cắt:
          </label>
          <UInput
            v-model.number="startPos"
            type="number"
            size="lg"
            :min="1"
            :ui="{ base: 'rounded-full' }"
          />
        </div>

        <!-- Vị trí kết thúc -->
        <div class="flex flex-col gap-2">
          <label class="text-[14px] font-medium text-neutral-800 dark:text-neutral-200">
            Cắt đến Vị trí số:
          </label>
          <UInput
            v-model.number="endPos"
            type="number"
            size="lg"
            :min="1"
            :ui="{ base: 'rounded-full' }"
          />
        </div>
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <label class="flex items-center gap-2 text-[12.5px] text-neutral-600 dark:text-neutral-400 cursor-pointer">
          <USwitch v-model="keepEmpty" size="xs" />
          Giữ dòng trống
        </label>
        <div class="flex-1" />
        <span class="text-[12px] text-neutral-500 dark:text-neutral-400">
          Sẽ lấy phần từ vị trí <strong>{{ startPos }}</strong> đến <strong>{{ endPos }}</strong>
          <template v-if="skipSet.size">, bỏ qua: {{ [...skipSet].join(', ') }}</template>
        </span>
      </div>
    </section>

    <!-- Input / Output -->
    <div class="grid gap-3 grid-cols-1 lg:grid-cols-2">
      <section class="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden min-h-[360px]">
        <div class="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60">
          <div class="flex items-center gap-2 text-[12.5px] font-semibold">
            <span class="w-2 h-2 rounded-full bg-blue-500" />
            Đầu vào
            <span class="ml-1 text-[11px] font-mono font-medium text-neutral-500 dark:text-neutral-400">{{ inCount }}</span>
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
          placeholder="DAAAAE....|user1|pass1
DAAAAAG....|user2|pass2
DAAAAAH....|user3|pass3"
          class="flex-1 resize-none border-0 outline-0 px-4 py-3.5 font-mono text-[13px] leading-relaxed bg-transparent text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
        />
      </section>

      <section class="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden min-h-[360px]">
        <div class="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60">
          <div class="flex items-center gap-2 text-[12.5px] font-semibold">
            <span class="w-2 h-2 rounded-full bg-primary-500" />
            Kết quả
            <span class="ml-1 text-[11px] font-mono font-medium text-neutral-500 dark:text-neutral-400">{{ outCount }}</span>
          </div>
          <div class="flex items-center gap-1">
            <UButton color="primary" size="xs" icon="i-lucide-check" @click="run">Cắt</UButton>
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-copy" @click="copyOutput">Copy</UButton>
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-download" square @click="downloadOutput" />
          </div>
        </div>
        <textarea
          v-model="output"
          spellcheck="false"
          readonly
          placeholder="Kết quả sẽ hiển thị tại đây..."
          class="flex-1 resize-none border-0 outline-0 px-4 py-3.5 font-mono text-[13px] leading-relaxed bg-transparent text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
        />
      </section>
    </div>
  </div>
</template>
