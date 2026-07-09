<script setup lang="ts">
import type { Field } from '~/composables/useTools'

const props = defineProps<{
  field: Field
  modelValue: any
}>()
const emit = defineEmits<{ 'update:modelValue': [value: any] }>()

const set = (v: any) => emit('update:modelValue', v)
</script>

<template>
  <!-- Info -->
  <div v-if="field.type === 'info'" class="text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed py-1">
    {{ field.text }}
  </div>

  <!-- Switch -->
  <label
    v-else-if="field.type === 'switch'"
    class="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors cursor-pointer"
  >
    <span class="text-[12.5px]">{{ field.label }}</span>
    <USwitch :model-value="!!modelValue" size="xs" @update:model-value="set" />
  </label>

  <!-- Segment -->
  <div v-else-if="field.type === 'segment'" class="flex flex-col gap-1.5">
    <label class="text-[12.5px] font-medium">{{ field.label }}</label>
    <div class="flex gap-0.5 p-0.5 rounded-md bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
      <button
        v-for="it in field.items"
        :key="it.value"
        type="button"
        class="flex-1 px-2 py-1 text-[12px] font-medium rounded transition-colors"
        :class="
          modelValue === it.value
            ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
        "
        @click="set(it.value)"
      >
        {{ it.label }}
      </button>
    </div>
  </div>

  <!-- Text -->
  <div v-else-if="field.type === 'text'" class="flex flex-col gap-1.5">
    <label class="text-[12.5px] font-medium">{{ field.label }}</label>
    <UInput
      :model-value="modelValue ?? ''"
      :placeholder="field.placeholder"
      size="sm"
      @update:model-value="set"
    />
    <span v-if="field.help" class="text-[11.5px] text-neutral-500 dark:text-neutral-400 leading-snug">{{ field.help }}</span>
  </div>

  <!-- Number -->
  <div v-else-if="field.type === 'number'" class="flex flex-col gap-1.5">
    <label class="text-[12.5px] font-medium">{{ field.label }}</label>
    <UInput
      type="number"
      :model-value="modelValue ?? 0"
      size="sm"
      @update:model-value="(v) => set(Number(v))"
    />
    <span v-if="field.help" class="text-[11.5px] text-neutral-500 dark:text-neutral-400 leading-snug">{{ field.help }}</span>
  </div>

  <!-- Textarea -->
  <div v-else-if="field.type === 'textarea'" class="flex flex-col gap-1.5">
    <label class="text-[12.5px] font-medium">{{ field.label }}</label>
    <UTextarea
      :model-value="modelValue ?? ''"
      :rows="3"
      :placeholder="field.placeholder"
      size="sm"
      :ui="{ base: 'font-mono text-[12.5px]' }"
      @update:model-value="set"
    />
    <span v-if="field.help" class="text-[11.5px] text-neutral-500 dark:text-neutral-400 leading-snug">{{ field.help }}</span>
  </div>
</template>
