<script setup lang="ts">
import { useTools, type Tool } from '~/composables/useTools'

const { tree, all } = useTools()
const route = useRoute()
const search = ref('')
const sidebarOpen = ref(false)

const currentSlug = computed(() => (route.params.slug as string) || '')
const current = computed<Tool | undefined>(() => all.find((t) => t.id === currentSlug.value))

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Cây danh mục cha → con, đã lọc theo từ khóa tìm kiếm.
const filteredTree = computed(() => {
  const q = norm(search.value.trim())
  if (!q) return tree
  return tree
    .map((c) => ({
      ...c,
      groups: c.groups
        .map((g) => ({ ...g, tools: g.tools.filter((t) => norm(`${t.name} ${t.desc}`).includes(q)) }))
        .filter((g) => g.tools.length > 0)
    }))
    .filter((c) => c.groups.length > 0)
})

// Thu gọn / mở rộng từng danh mục cha.
const collapsed = ref<Record<string, boolean>>({})
const toggleCat = (id: string) => (collapsed.value[id] = !collapsed.value[id])
const isOpen = (id: string) => !!search.value.trim() || !collapsed.value[id]

// Cmd/Ctrl + K to focus search
const searchInput = ref<HTMLInputElement | null>(null)
onMounted(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      searchInput.value?.focus()
    }
  }
  window.addEventListener('keydown', handler)
  onBeforeUnmount(() => window.removeEventListener('keydown', handler))
})

// Close sidebar when navigating on mobile
watch(currentSlug, () => (sidebarOpen.value = false))
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
    <div class="flex">
      <!-- Sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-30 w-[264px] flex flex-col bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0"
        :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <!-- Brand -->
        <div class="flex items-center justify-between px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
          <NuxtLink to="/" class="flex items-center gap-2.5">
            <div class="w-8 h-8 grid place-items-center bg-primary-500 dark:bg-primary-400 text-white rounded-lg font-bold text-[13px] tracking-tight">
              Tk
            </div>
            <div>
              <div class="font-semibold text-[14px] leading-tight tracking-tight">TextKit</div>
              <div class="text-[11.5px] text-neutral-500 dark:text-neutral-400">Tiện ích text online</div>
            </div>
          </NuxtLink>
          <UButton
            class="lg:hidden"
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-x"
            square
            @click="sidebarOpen = false"
          />
        </div>

        <!-- Search -->
        <div class="px-3 pt-3">
          <UInput
            ref="searchInput"
            v-model="search"
            placeholder="Tìm tiện ích…"
            icon="i-lucide-search"
            size="sm"
            class="w-full"
          >
            <template #trailing>
              <UKbd>K</UKbd>
            </template>
          </UInput>
        </div>

        <!-- Tool list — danh mục cha → nhóm con → tiện ích -->
        <nav class="flex-1 overflow-y-auto px-2 pt-2 pb-3">
          <div v-for="c in filteredTree" :key="c.id" class="mb-1.5">
            <!-- Danh mục cha (bấm để thu gọn) -->
            <button
              type="button"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60 transition-colors"
              @click="toggleCat(c.id)"
            >
              <UIcon :name="c.icon" class="w-4 h-4 flex-shrink-0 text-primary-500" />
              <span class="flex-1 text-left">{{ c.label }}</span>
              <UIcon
                :name="isOpen(c.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="w-3.5 h-3.5 text-neutral-400"
              />
            </button>

            <div v-show="isOpen(c.id)" class="mt-0.5">
              <div v-for="g in c.groups" :key="g.id" class="mb-1">
                <div class="px-3 pt-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  {{ g.label }}
                </div>
                <NuxtLink
                  v-for="t in g.tools"
                  :key="t.id"
                  :to="`/${t.id}`"
                  class="flex items-center gap-2.5 pl-4 pr-3 py-1.5 rounded-md text-[13.5px] font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-50 transition-colors"
                  active-class="!bg-primary-50 dark:!bg-primary-500/10 !text-primary-700 dark:!text-primary-300"
                >
                  <UIcon :name="t.icon" class="w-4 h-4 flex-shrink-0" />
                  <span class="flex-1 truncate">{{ t.name }}</span>
                </NuxtLink>
              </div>
            </div>
          </div>
          <div v-if="filteredTree.length === 0" class="px-4 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Không tìm thấy tiện ích.
          </div>
        </nav>
      </aside>

      <!-- Backdrop for mobile -->
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-20 bg-black/40 lg:hidden"
        @click="sidebarOpen = false"
      />

      <!-- Main -->
      <div class="flex-1 min-w-0 flex flex-col lg:ml-0">
        <!-- Top bar -->
        <header
          class="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-6 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur"
        >
          <UButton
            class="lg:hidden"
            variant="ghost"
            color="neutral"
            size="sm"
            icon="i-lucide-menu"
            square
            @click="sidebarOpen = true"
          />
          <nav class="flex-1 flex items-center gap-1.5 text-[13px] text-neutral-500 dark:text-neutral-400">
            <NuxtLink to="/" class="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Trang chủ</NuxtLink>
            <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5" />
            <span>Tiện ích</span>
            <template v-if="current">
              <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5" />
              <span class="text-neutral-900 dark:text-neutral-100 font-semibold">{{ current.name }}</span>
            </template>
          </nav>
          <div class="flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>

        <main class="flex-1 min-w-0">
          <slot />
        </main>
      </div>
    </div>

    <FeedbackWidget />
  </div>
</template>
