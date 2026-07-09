<script setup lang="ts">
import type { Tool } from '~/composables/useTools'
import { GROUPS } from '~/composables/useTools'

const props = defineProps<{ tool: Tool }>()
const groupLabel = computed(() => GROUPS.find((g) => g.id === props.tool.group)?.label || '')
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
    <div class="flex items-center gap-3.5">
      <div class="w-11 h-11 grid place-items-center rounded-lg bg-primary-100 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300">
        <UIcon :name="tool.icon" class="w-5 h-5" />
      </div>
      <div>
        <h1 class="text-[22px] font-bold tracking-tight leading-tight">{{ tool.name }}</h1>
        <p class="text-[13.5px] text-neutral-600 dark:text-neutral-400 mt-0.5 max-w-[680px]">{{ tool.desc }}</p>
      </div>
    </div>
    <UBadge color="primary" variant="soft" size="sm" class="self-start sm:self-center">{{ groupLabel }}</UBadge>
  </div>
</template>
