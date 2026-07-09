<script setup lang="ts">
import { useTools } from '~/composables/useTools'

const route = useRoute()
const { findById } = useTools()

const tool = computed(() => findById(String(route.params.slug)))

if (!tool.value) {
  throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy tiện ích' })
}

useHead({
  title: () => `${tool.value!.name} — DevKit`,
  meta: [{ name: 'description', content: () => tool.value!.desc }]
})
</script>

<template>
  <div v-if="tool" class="px-4 lg:px-6 py-5 lg:py-7 max-w-[1280px] mx-auto w-full flex flex-col gap-4">
    <ToolHead :tool="tool" />

    <LazyToolsDiffTool v-if="tool.custom === 'diff'" />
    <LazyToolsWordCounterTool v-else-if="tool.custom === 'word-counter'" />
    <LazyToolsCutStringTool v-else-if="tool.custom === 'cut-string'" />
    <LazyToolsCutLineTool v-else-if="tool.custom === 'cut-line'" />
    <LazyToolsDuplicatesTool v-else-if="tool.custom === 'duplicates'" />
    <LazyToolsTotpTool v-else-if="tool.custom === 'totp'" />
    <LazyToolsMyIpTool v-else-if="tool.custom === 'my-ip'" />    <LazyToolsMailReaderTool v-else-if="tool.custom === 'mail-reader'" />
    <LazyToolsOAuthHelperTool v-else-if="tool.custom === 'oauth-helper'" />
    <StandardTool v-else :key="tool.id" :tool="tool" />
  </div>
</template>
