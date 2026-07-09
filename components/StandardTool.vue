<script setup lang="ts">
import type { Tool, Field } from '~/composables/useTools'
import { splitLines } from '~/composables/useTextOps'

const props = defineProps<{ tool: Tool }>()
const toast = useToast()

const input = ref('')
const output = ref('')
const fileRef = ref<HTMLInputElement | null>(null)

// Build initial options from schema
const buildDefaults = (tool: Tool): Record<string, any> => {
  const o: Record<string, any> = {}
  for (const f of tool.options || []) {
    if ('key' in f && f.value !== undefined) o[f.key] = f.value
  }
  return o
}
const options = ref<Record<string, any>>(buildDefaults(props.tool))

watch(
  () => props.tool.id,
  () => {
    options.value = buildDefaults(props.tool)
    input.value = ''
    output.value = ''
  }
)

const visibleOptions = computed(() =>
  (props.tool.options || []).filter((f) => f.type !== 'info' || true)
)

const inCount = computed(() => formatCount(input.value))
const outCount = computed(() => formatCount(output.value))

function formatCount(s: string) {
  const lines = s === '' ? 0 : splitLines(s).length
  return `${s.length.toLocaleString('vi-VN')} ký tự · ${lines.toLocaleString('vi-VN')} dòng`
}

const isHash = computed(() => props.tool.id === 'hash-text')

async function runHash() {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return ''
  const algo = options.value.algo || 'SHA-256'
  const data = new TextEncoder().encode(input.value)
  const buf = await crypto.subtle.digest(algo, data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function run() {
  try {
    if (isHash.value) {
      output.value = await runHash()
      return
    }
    output.value = props.tool.run ? props.tool.run(input.value, options.value) : input.value
  } catch (e: any) {
    output.value = `❌ Lỗi: ${e.message}`
  }
}

let runTimer: ReturnType<typeof setTimeout> | null = null
function debouncedRun() {
  if (runTimer) clearTimeout(runTimer)
  runTimer = setTimeout(run, 200)
}

watch([input, options], debouncedRun, { deep: true })
onMounted(run)

async function paste() {
  try {
    const t = await navigator.clipboard.readText()
    input.value = t
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
    .catch(() => toast.add({ title: 'Copy thất bại', color: 'error' }))
}
function downloadOutput() {
  if (!output.value) return
  const blob = new Blob([output.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.tool.id}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
async function onFiles(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files?.length) return
  if (props.tool.onFiles) {
    input.value = await props.tool.onFiles(files, options.value)
  } else {
    const texts = await Promise.all([...files].map((f) => f.text()))
    input.value = texts.join('\n')
  }
  target.value = ''
  toast.add({ title: `Đã tải ${files.length} file`, color: 'success', icon: 'i-lucide-file-up' })
}
</script>

<template>
  <div class="grid gap-3 grid-cols-1 lg:grid-cols-[1fr_280px_1fr]">
    <!-- Input panel -->
    <section class="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden min-h-[420px]">
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
        :placeholder="tool.example || 'Dán hoặc nhập nội dung tại đây...'"
        class="flex-1 resize-none border-0 outline-0 px-4 py-3.5 font-mono text-[13px] leading-relaxed bg-transparent text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 placeholder:whitespace-pre-line"
      />
    </section>

    <!-- Options panel -->
    <aside class="flex flex-col gap-2.5 p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl min-h-[420px] overflow-y-auto">
      <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        Tùy chọn
      </div>
      <template v-if="(tool.options || []).length">
        <OptionField
          v-for="(f, i) in tool.options"
          :key="('key' in f ? f.key : '') + i"
          :field="f"
          :model-value="('key' in f) ? options[f.key] : null"
          @update:model-value="(v) => 'key' in f && (options[f.key] = v)"
        />
      </template>
      <div v-else class="text-[12.5px] text-neutral-500 dark:text-neutral-400 text-center py-6 border border-dashed border-neutral-200 dark:border-neutral-700 rounded-md">
        Tiện ích này không cần thiết lập.
      </div>
    </aside>

    <!-- Output panel -->
    <section class="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden min-h-[420px]">
      <div class="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60">
        <div class="flex items-center gap-2 text-[12.5px] font-semibold">
          <span class="w-2 h-2 rounded-full bg-primary-500" />
          Kết quả
          <span class="ml-1 text-[11px] font-mono font-medium text-neutral-500 dark:text-neutral-400">{{ outCount }}</span>
        </div>
        <div class="flex items-center gap-1">
          <UButton color="primary" size="xs" icon="i-lucide-check" @click="run">Xử lý</UButton>
          <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-copy" @click="copyOutput">Copy</UButton>
          <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-download" square @click="downloadOutput" />
        </div>
      </div>
      <textarea
        v-model="output"
        spellcheck="false"
        readonly
        placeholder="Kết quả xử lý sẽ hiển thị ở đây..."
        class="flex-1 resize-none border-0 outline-0 px-4 py-3.5 font-mono text-[13px] leading-relaxed bg-transparent text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
      />
    </section>
  </div>
</template>
