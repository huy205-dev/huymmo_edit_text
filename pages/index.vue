<script setup lang="ts">
import { useTools } from '~/composables/useTools'

const { tree, all } = useTools()

useHead({
  title: 'DevKit — Bộ công cụ online cho dev & marketer'
})
</script>

<template>
  <div class="px-4 lg:px-6 py-6 lg:py-8 max-w-[1280px] mx-auto w-full">
    <!-- Hero -->
    <section class="text-center max-w-2xl mx-auto mb-10">
      <UBadge color="primary" variant="soft" size="md" class="mb-4">
        <UIcon name="i-lucide-sparkles" class="w-3.5 h-3.5" />
        <span class="ml-1">{{ all.length }} tiện ích miễn phí</span>
      </UBadge>
      <h1 class="text-[32px] sm:text-[40px] font-bold tracking-tight leading-tight">
        Bộ <span class="text-primary-600 dark:text-primary-400">công cụ online</span> cho dev &amp; marketer
      </h1>
      <p class="mt-3 text-[15px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
        Xử lý text, JSON &amp; Base64, regex, UUID, mã hoá &amp; hash, mạng (subnet/SPF/DMARC), SEO, đọc mail… Phần lớn chạy ngay trên trình duyệt — dữ liệu không gửi đi đâu cả.
      </p>
      <div class="mt-5 flex items-center justify-center gap-2">
        <UButton color="primary" size="md" :to="`/${all[0].id}`" trailing-icon="i-lucide-arrow-right">
          Bắt đầu ngay
        </UButton>
        <UButton variant="outline" color="neutral" size="md" to="/word-counter" icon="i-lucide-text">
          Word Counter
        </UButton>
      </div>
    </section>

    <PrivacyNote class="mb-8" />

    <!-- Grid 3 cấp: cha (super) → con (category) → cháu (group) -->
    <div v-for="s in tree" :key="s.id" class="mb-14">
      <div class="flex items-center gap-2.5 mb-6">
        <UIcon :name="s.icon" class="w-6 h-6 text-primary-500" />
        <h2 class="text-[22px] font-bold tracking-tight">{{ s.label }}</h2>
      </div>
      <div v-for="c in s.categories" :key="c.id" class="mb-9">
        <div class="flex items-center gap-2 mb-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
          <UIcon :name="c.icon" class="w-4 h-4 text-neutral-400" />
          <h3 class="text-[16px] font-semibold tracking-tight">{{ c.label }}</h3>
        </div>
        <div v-for="g in c.groups" :key="g.id" class="mb-6">
          <h4 class="text-[12px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">{{ g.label }}</h4>
          <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <NuxtLink
              v-for="t in g.tools"
              :key="t.id"
              :to="`/${t.id}`"
              class="group flex items-start gap-3 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-primary-300 dark:hover:border-primary-500/40 hover:shadow-sm transition-all"
            >
              <div class="w-10 h-10 grid place-items-center rounded-lg bg-neutral-100 dark:bg-neutral-800 group-hover:bg-primary-100 dark:group-hover:bg-primary-500/20 text-neutral-700 dark:text-neutral-300 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors flex-shrink-0">
                <UIcon :name="t.icon" class="w-5 h-5" />
              </div>
              <div class="min-w-0">
                <div class="font-semibold text-[14px] tracking-tight group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                  {{ t.name }}
                </div>
                <div class="text-[12.5px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2 leading-snug">
                  {{ t.desc }}
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
