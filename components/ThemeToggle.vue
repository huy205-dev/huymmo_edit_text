<script setup lang="ts">
const colorMode = useColorMode()
const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (v) => (colorMode.preference = v ? 'dark' : 'light')
})
</script>

<template>
  <ClientOnly>
    <UButton
      :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
      variant="ghost"
      color="neutral"
      size="sm"
      square
      :aria-label="isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'"
      @click="isDark = !isDark"
    />
    <template #fallback>
      <UButton icon="i-lucide-sun" variant="ghost" color="neutral" size="sm" square />
    </template>
  </ClientOnly>
</template>
