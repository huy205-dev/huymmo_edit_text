<script setup lang="ts">
import { useTools } from '~/composables/useTools'

const toast = useToast()
const route = useRoute()
const { findById } = useTools()

const open = ref(false)
const submitting = ref(false)

type FeedbackType = 'bug' | 'suggestion' | 'question'
const form = reactive<{ type: FeedbackType; title: string; description: string; email: string }>({
  type: 'bug',
  title: '',
  description: '',
  email: ''
})

// Tự động detect tool đang dùng từ slug.
const currentTool = computed(() => {
  const slug = route.params.slug as string | undefined
  if (!slug) return null
  return findById(slug)
})

function reset() {
  form.type = 'bug'
  form.title = ''
  form.description = ''
  form.email = ''
}

const titleLen = computed(() => form.title.trim().length)
const descLen = computed(() => form.description.trim().length)
const titleValid = computed(() => titleLen.value >= 5 && titleLen.value <= 200)
const descValid = computed(() => descLen.value >= 10 && descLen.value <= 5000)
const showErrors = ref(false)

async function submit() {
  showErrors.value = true
  if (!titleValid.value) {
    toast.add({
      title: 'Tiêu đề chưa hợp lệ',
      description: titleLen.value === 0 ? 'Vui lòng nhập tiêu đề' : `Tiêu đề cần 5-200 ký tự (hiện ${titleLen.value})`,
      color: 'warning',
      icon: 'i-lucide-alert-circle'
    })
    return
  }
  if (!descValid.value) {
    toast.add({
      title: 'Mô tả chưa đủ chi tiết',
      description: descLen.value === 0 ? 'Vui lòng nhập mô tả' : `Mô tả cần 10-5000 ký tự (hiện ${descLen.value})`,
      color: 'warning',
      icon: 'i-lucide-alert-circle'
    })
    return
  }
  if (submitting.value) return
  submitting.value = true
  try {
    const r = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: form.type,
        tool: currentTool.value?.id || null,
        title: form.title.trim(),
        description: form.description.trim(),
        email: form.email.trim() || undefined
      })
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      throw new Error(j.statusMessage || j.message || `HTTP ${r.status}`)
    }
    toast.add({
      title: 'Đã gửi! Cảm ơn bạn 💚',
      description: 'Mình sẽ xem lại và phản hồi sớm nếu để lại email.',
      color: 'success',
      icon: 'i-lucide-check-circle-2'
    })
    open.value = false
    reset()
    showErrors.value = false
  } catch (e: any) {
    toast.add({
      title: 'Gửi thất bại',
      description: e.message || 'Lỗi không xác định',
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  } finally {
    submitting.value = false
  }
}

const types: { value: FeedbackType; label: string; emoji: string; desc: string }[] = [
  { value: 'bug', label: 'Báo lỗi', emoji: '🐛', desc: 'Có gì đó không hoạt động đúng' },
  { value: 'suggestion', label: 'Góp ý', emoji: '💡', desc: 'Đề xuất tính năng mới hoặc cải thiện' },
  { value: 'question', label: 'Câu hỏi', emoji: '❓', desc: 'Cách sử dụng, thắc mắc khác' }
]
</script>

<template>
  <ClientOnly>
    <!-- Floating button -->
    <button
      type="button"
      class="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 transition-all hover:scale-105"
      :class="open ? 'opacity-0 pointer-events-none' : ''"
      :title="'Báo lỗi hoặc góp ý'"
      @click="open = true"
    >
      <UIcon name="i-lucide-message-square-plus" class="w-4 h-4" />
      <span class="font-semibold text-[13px] hidden sm:inline">Góp ý / Báo lỗi</span>
    </button>

    <!-- Backdrop -->
    <transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        @click="open = false"
      />
    </transition>

    <!-- Modal -->
    <transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-4 scale-95"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
      >
        <div
          class="pointer-events-auto w-full sm:max-w-[560px] bg-white dark:bg-neutral-900 border-t sm:border border-neutral-200 dark:border-neutral-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
            <div class="flex items-center gap-2.5">
              <UIcon name="i-lucide-message-square-plus" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <div class="font-semibold text-[15px]">Góp ý / Báo lỗi</div>
            </div>
            <button
              type="button"
              class="w-8 h-8 grid place-items-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
              @click="open = false"
            >
              <UIcon name="i-lucide-x" class="w-4 h-4" />
            </button>
          </div>

          <div class="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <!-- Current tool indicator -->
            <div
              v-if="currentTool"
              class="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20 text-[12px] text-primary-700 dark:text-primary-300"
            >
              <UIcon :name="currentTool.icon" class="w-3.5 h-3.5" />
              <span>Phản hồi cho tool <strong>{{ currentTool.name }}</strong></span>
            </div>

            <!-- Type selector -->
            <div>
              <label class="text-[12.5px] font-semibold mb-2 block">Loại phản hồi</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="t in types"
                  :key="t.value"
                  type="button"
                  class="flex flex-col items-center gap-1 px-2 py-3 rounded-lg border-2 transition-all"
                  :class="
                    form.type === t.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                  "
                  @click="form.type = t.value"
                >
                  <span class="text-[22px] leading-none">{{ t.emoji }}</span>
                  <span class="font-semibold text-[12.5px]">{{ t.label }}</span>
                  <span class="text-[10.5px] text-neutral-500 dark:text-neutral-400 text-center leading-tight">{{ t.desc }}</span>
                </button>
              </div>
            </div>

            <!-- Title -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-[12.5px] font-semibold">Tiêu đề <span class="text-red-500">*</span></label>
                <span
                  class="text-[11px] font-mono"
                  :class="
                    titleLen > 200 ? 'text-red-500' : titleValid ? 'text-green-600 dark:text-green-400' : 'text-neutral-400'
                  "
                >{{ titleLen }}/200</span>
              </div>
              <UInput
                v-model="form.title"
                size="md"
                :placeholder="form.type === 'bug' ? 'VD: Regex Tester lỗi khi để pattern rỗng' : 'Tóm tắt ngắn gọn ý của bạn'"
                :class="showErrors && !titleValid ? 'ring-2 ring-red-500/40 rounded-lg' : ''"
              />
            </div>

            <!-- Description -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-[12.5px] font-semibold">Mô tả chi tiết <span class="text-red-500">*</span></label>
                <span
                  class="text-[11px] font-mono"
                  :class="
                    descLen > 5000 ? 'text-red-500' : descValid ? 'text-green-600 dark:text-green-400' : 'text-neutral-400'
                  "
                >{{ descLen }}/5000</span>
              </div>
              <textarea
                v-model="form.description"
                rows="6"
                spellcheck="true"
                :placeholder="
                  form.type === 'bug'
                    ? 'Bước tái hiện lỗi:\n1. Mở tool X\n2. Nhập Y\n3. Bấm Z → kết quả không như mong đợi\n\nKết quả mong muốn: ...'
                    : 'Chi tiết về tính năng / câu hỏi của bạn...'
                "
                class="w-full resize-y border rounded-lg px-3 py-2.5 text-[13.5px] leading-relaxed bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
                :class="
                  showErrors && !descValid
                    ? 'border-red-500/60 ring-2 ring-red-500/40'
                    : 'border-neutral-200 dark:border-neutral-700'
                "
              />
            </div>

            <!-- Email (optional) -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-[12.5px] font-semibold">Email <span class="text-neutral-400 font-normal">(không bắt buộc)</span></label>
              </div>
              <UInput
                v-model="form.email"
                type="email"
                size="md"
                placeholder="email@example.com — để mình phản hồi nếu cần"
              />
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60">
            <div class="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
              <UIcon name="i-lucide-shield" class="w-3 h-3" />
              <span>Không tự ý gửi data của bạn — chỉ thông tin form này</span>
            </div>
            <div class="flex gap-2">
              <UButton variant="ghost" color="neutral" size="sm" @click="open = false">Hủy</UButton>
              <UButton
                color="primary"
                size="sm"
                icon="i-lucide-send"
                :loading="submitting"
                @click="submit"
              >
                Gửi
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </ClientOnly>
</template>
