<script setup lang="ts">
import { splitLines, joinLines } from '~/composables/useTextOps'

const toast = useToast()

type Mode =
  | 'a-minus-b'    // Có ở A, không ở B (loại trùng với B)
  | 'a-and-b'      // Có ở cả A và B (giao)
  | 'a-or-b'       // Hợp A và B (loại trùng)
  | 'a-xor-b'      // Chỉ ở A hoặc chỉ ở B (không chung)
  | 'a-unique'     // Loại trùng trong A
  | 'a-dups'       // Chỉ các dòng bị trùng trong A
  | 'a-count'      // Đếm số lần lặp trong A

const a = ref('')
const b = ref('')
const output = ref('')

const mode = ref<Mode>('a-minus-b')
const trim = ref(true)
const caseInsensitive = ref(false)
const skipEmpty = ref(true)
const keepOrder = ref(true)

const norm = (s: string) => {
  let v = s
  if (trim.value) v = v.trim()
  if (caseInsensitive.value) v = v.toLocaleLowerCase('vi')
  return v
}

const aLines = computed(() => {
  let l = splitLines(a.value)
  if (skipEmpty.value) l = l.filter((x) => x.trim() !== '')
  return l
})
const bLines = computed(() => {
  let l = splitLines(b.value)
  if (skipEmpty.value) l = l.filter((x) => x.trim() !== '')
  return l
})

const aSet = computed(() => new Set(aLines.value.map(norm)))
const bSet = computed(() => new Set(bLines.value.map(norm)))

function dedupKeepOrder(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const l of arr) {
    const k = norm(l)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(l)
    }
  }
  return out
}

const result = computed<string[]>(() => {
  switch (mode.value) {
    case 'a-minus-b': {
      const out = aLines.value.filter((l) => !bSet.value.has(norm(l)))
      return keepOrder.value ? out : dedupKeepOrder(out)
    }
    case 'a-and-b': {
      const out = aLines.value.filter((l) => bSet.value.has(norm(l)))
      return dedupKeepOrder(out)
    }
    case 'a-or-b': {
      return dedupKeepOrder([...aLines.value, ...bLines.value])
    }
    case 'a-xor-b': {
      const out: string[] = []
      for (const l of aLines.value) if (!bSet.value.has(norm(l))) out.push(l)
      for (const l of bLines.value) if (!aSet.value.has(norm(l))) out.push(l)
      return dedupKeepOrder(out)
    }
    case 'a-unique':
      return dedupKeepOrder(aLines.value)
    case 'a-dups': {
      const counts = new Map<string, number>()
      aLines.value.forEach((l) => counts.set(norm(l), (counts.get(norm(l)) || 0) + 1))
      const out = aLines.value.filter((l) => (counts.get(norm(l)) || 0) > 1)
      return dedupKeepOrder(out)
    }
    case 'a-count': {
      const counts = new Map<string, number>()
      aLines.value.forEach((l) => counts.set(norm(l), (counts.get(norm(l)) || 0) + 1))
      return [...counts.entries()]
        .sort((x, y) => y[1] - x[1])
        .map(([k, v]) => `${v}\t${k}`)
    }
  }
})

watch(result, (v) => (output.value = joinLines(v)), { immediate: true })

const stats = computed(() => ({
  aCount: aLines.value.length,
  bCount: bLines.value.length,
  aUnique: aSet.value.size,
  bUnique: bSet.value.size,
  out: result.value.length
}))

const modes: { value: Mode; label: string; help: string }[] = [
  { value: 'a-minus-b', label: 'A − B', help: 'Có ở A, không có ở B' },
  { value: 'a-and-b',   label: 'A ∩ B', help: 'Có ở cả A và B' },
  { value: 'a-or-b',    label: 'A ∪ B', help: 'Hợp cả hai, đã loại trùng' },
  { value: 'a-xor-b',   label: 'A ⊕ B', help: 'Chỉ ở một bên, không chung' },
  { value: 'a-unique',  label: 'Unique A', help: 'Loại trùng trong A' },
  { value: 'a-dups',    label: 'Dup A', help: 'Chỉ các dòng bị trùng trong A' },
  { value: 'a-count',   label: 'Đếm A', help: 'Đếm số lần lặp trong A' }
]
const currentHelp = computed(() => modes.find((m) => m.value === mode.value)?.help)

async function pasteTo(target: 'a' | 'b') {
  try {
    const t = await navigator.clipboard.readText()
    if (target === 'a') a.value = t
    else b.value = t
    toast.add({ title: `Đã dán vào ${target.toUpperCase()}`, color: 'success', icon: 'i-lucide-clipboard' })
  } catch {
    toast.add({ title: 'Không truy cập được clipboard', color: 'error' })
  }
}
function swap() {
  ;[a.value, b.value] = [b.value, a.value]
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
  link.download = 'duplicates.txt'
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Options card -->
    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
      <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        Chế độ so sánh
      </div>

      <div class="flex flex-wrap gap-1.5 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800">
        <button
          v-for="m in modes"
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

      <div class="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-4">
        <label class="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 cursor-pointer">
          <span class="text-[12.5px]">Trim khoảng trắng</span>
          <USwitch v-model="trim" size="xs" />
        </label>
        <label class="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 cursor-pointer">
          <span class="text-[12.5px]">Bỏ qua hoa/thường</span>
          <USwitch v-model="caseInsensitive" size="xs" />
        </label>
        <label class="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 cursor-pointer">
          <span class="text-[12.5px]">Bỏ dòng trống</span>
          <USwitch v-model="skipEmpty" size="xs" />
        </label>
        <label class="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 cursor-pointer">
          <span class="text-[12.5px]">Giữ thứ tự A</span>
          <USwitch v-model="keepOrder" size="xs" />
        </label>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-neutral-500 dark:text-neutral-400 font-mono pt-3 border-t border-neutral-200 dark:border-neutral-800">
        <span><strong class="text-neutral-700 dark:text-neutral-300">A:</strong> {{ stats.aCount }} dòng / {{ stats.aUnique }} unique</span>
        <span><strong class="text-neutral-700 dark:text-neutral-300">B:</strong> {{ stats.bCount }} dòng / {{ stats.bUnique }} unique</span>
        <span class="text-primary-700 dark:text-primary-400"><strong>Kết quả:</strong> {{ stats.out }} dòng</span>
        <div class="flex-1" />
        <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-arrow-left-right" @click="swap">Đổi A ↔ B</UButton>
      </div>
    </section>

    <!-- A / B / Output -->
    <div class="grid gap-3 grid-cols-1 lg:grid-cols-3">
      <!-- A -->
      <section class="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden min-h-[380px]">
        <div class="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60">
          <div class="flex items-center gap-2 text-[12.5px] font-semibold">
            <span class="w-5 h-5 grid place-items-center rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-[11px]">A</span>
            Danh sách A
            <span class="ml-1 text-[11px] font-mono font-medium text-neutral-500 dark:text-neutral-400">{{ stats.aCount }} dòng</span>
          </div>
          <div class="flex items-center gap-1">
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-clipboard" @click="pasteTo('a')">Dán</UButton>
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-trash-2" square @click="a = ''" />
          </div>
        </div>
        <textarea
          v-model="a"
          spellcheck="false"
          placeholder="nguyenan@gmail.com
tranbinh@gmail.com
phamcuong@gmail.com
nguyenan@gmail.com
levuong@gmail.com
tranbinh@gmail.com"
          class="flex-1 resize-none border-0 outline-0 px-4 py-3.5 font-mono text-[13px] leading-relaxed bg-transparent"
        />
      </section>

      <!-- B -->
      <section class="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden min-h-[380px]">
        <div class="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60">
          <div class="flex items-center gap-2 text-[12.5px] font-semibold">
            <span class="w-5 h-5 grid place-items-center rounded-md bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 font-bold text-[11px]">B</span>
            Danh sách B
            <span class="ml-1 text-[11px] font-mono font-medium text-neutral-500 dark:text-neutral-400">{{ stats.bCount }} dòng</span>
          </div>
          <div class="flex items-center gap-1">
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-clipboard" @click="pasteTo('b')">Dán</UButton>
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-trash-2" square @click="b = ''" />
          </div>
        </div>
        <textarea
          v-model="b"
          spellcheck="false"
          placeholder="phamcuong@gmail.com
truongminh@gmail.com
levuong@gmail.com
hoangviet@gmail.com"
          class="flex-1 resize-none border-0 outline-0 px-4 py-3.5 font-mono text-[13px] leading-relaxed bg-transparent"
        />
      </section>

      <!-- Output -->
      <section class="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden min-h-[380px]">
        <div class="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60">
          <div class="flex items-center gap-2 text-[12.5px] font-semibold">
            <span class="w-2 h-2 rounded-full bg-primary-500" />
            Kết quả
            <span class="ml-1 text-[11px] font-mono font-medium text-neutral-500 dark:text-neutral-400">{{ stats.out }} dòng</span>
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
          placeholder="Kết quả lọc trùng sẽ hiển thị tại đây..."
          class="flex-1 resize-none border-0 outline-0 px-4 py-3.5 font-mono text-[13px] leading-relaxed bg-transparent"
        />
      </section>
    </div>
  </div>
</template>
