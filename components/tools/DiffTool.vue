<script setup lang="ts">
import { diffLines, splitLines } from '~/composables/useTextOps'

const left = ref('')
const right = ref('')
const ignoreWs = ref(false)
const ignoreCase = ref(false)

const result = computed(() => {
  const norm = (s: string) => {
    let v = s
    if (ignoreCase.value) v = v.toLocaleLowerCase('vi')
    if (ignoreWs.value) v = v.replace(/\s+/g, ' ').trim()
    return v
  }
  const a = splitLines(left.value).map(norm)
  const b = splitLines(right.value).map(norm)
  return diffLines(a, b)
})

const stats = computed(() => {
  let add = 0, del = 0
  for (const x of result.value) {
    if (x.type === 'add') add++
    else if (x.type === 'del') del++
  }
  return { add, del, eq: result.value.length - add - del }
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="grid gap-3 grid-cols-1 md:grid-cols-2">
      <section class="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden min-h-[260px]">
        <div class="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60">
          <div class="text-[12.5px] font-semibold flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-red-500" />
            Bản gốc
          </div>
        </div>
        <textarea
          v-model="left"
          spellcheck="false"
          placeholder="Xin chào các bạn,
Đây là phiên bản gốc của tài liệu.
Chúng ta sẽ thử thay đổi một số nội dung
và xem TextKit highlight ra sao."
          class="flex-1 resize-none border-0 outline-0 px-4 py-3.5 font-mono text-[13px] leading-relaxed bg-transparent"
        />
      </section>
      <section class="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden min-h-[260px]">
        <div class="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60">
          <div class="text-[12.5px] font-semibold flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-primary-500" />
            Bản mới
          </div>
        </div>
        <textarea
          v-model="right"
          spellcheck="false"
          placeholder="Xin chào mọi người,
Đây là phiên bản MỚI của tài liệu.
Chúng ta vừa cập nhật một số nội dung
và xem TextKit highlight ra sao.
Thêm dòng mới ở cuối."
          class="flex-1 resize-none border-0 outline-0 px-4 py-3.5 font-mono text-[13px] leading-relaxed bg-transparent"
        />
      </section>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UButton variant="outline" color="neutral" size="xs" :icon="ignoreWs ? 'i-lucide-check-square' : 'i-lucide-square'" @click="ignoreWs = !ignoreWs">
        Bỏ qua khoảng trắng
      </UButton>
      <UButton variant="outline" color="neutral" size="xs" :icon="ignoreCase ? 'i-lucide-check-square' : 'i-lucide-square'" @click="ignoreCase = !ignoreCase">
        Bỏ qua hoa/thường
      </UButton>
      <div class="flex-1" />
      <UBadge color="primary" variant="soft" size="sm">+{{ stats.add }} thêm</UBadge>
      <UBadge color="error" variant="soft" size="sm">-{{ stats.del }} xóa</UBadge>
      <UBadge color="neutral" variant="soft" size="sm">{{ stats.eq }} giữ nguyên</UBadge>
    </div>

    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      <div class="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 text-[12.5px] font-semibold">
        Kết quả so sánh
      </div>
      <div class="font-mono text-[13px] leading-relaxed py-2 max-h-[480px] overflow-auto">
        <div
          v-for="(it, i) in result"
          :key="i"
          class="px-4 py-0.5 whitespace-pre-wrap"
          :class="{
            'bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300': it.type === 'add',
            'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 line-through': it.type === 'del'
          }"
        >
          <span class="select-none mr-3 text-neutral-400 dark:text-neutral-600">{{ it.type === 'add' ? '+' : it.type === 'del' ? '-' : ' ' }}</span>
          {{ it.text || '​' }}
        </div>
        <div v-if="result.length === 0" class="px-4 py-6 text-center text-neutral-400">Nhập nội dung vào hai bên để so sánh.</div>
      </div>
    </section>
  </div>
</template>
