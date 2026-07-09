<script setup lang="ts">
const work = ref(25)
const breakMin = ref(5)
const sound = ref(true)

const isWork = ref(true)
const remaining = ref(work.value * 60)
const running = ref(false)
let interval: ReturnType<typeof setInterval> | null = null

const time = computed(() => {
  const m = Math.floor(remaining.value / 60).toString().padStart(2, '0')
  const s = (remaining.value % 60).toString().padStart(2, '0')
  return `${m}:${s}`
})
const mode = computed(() => (isWork.value ? 'Làm việc' : 'Nghỉ ngơi'))
const progress = computed(() => {
  const total = (isWork.value ? work.value : breakMin.value) * 60
  return total ? 1 - remaining.value / total : 0
})

function beep() {
  if (!sound.value || typeof window === 'undefined') return
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 880
    o.connect(g); g.connect(ctx.destination)
    g.gain.setValueAtTime(0, ctx.currentTime)
    g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05)
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6)
    o.start(); o.stop(ctx.currentTime + 0.6)
  } catch {}
}

function tick() {
  if (remaining.value <= 0) {
    beep()
    isWork.value = !isWork.value
    remaining.value = (isWork.value ? work.value : breakMin.value) * 60
    if (typeof document !== 'undefined') {
      document.title = `${time.value} · ${isWork.value ? '🍅 Focus' : '☕ Nghỉ'} — TextKit`
    }
  } else {
    remaining.value--
    if (typeof document !== 'undefined') {
      document.title = `${time.value} · ${isWork.value ? '🍅 Focus' : '☕ Nghỉ'} — TextKit`
    }
  }
}
function toggle() {
  if (running.value) {
    if (interval) clearInterval(interval)
    running.value = false
  } else {
    running.value = true
    interval = setInterval(tick, 1000)
  }
}
function reset() {
  if (interval) clearInterval(interval)
  running.value = false
  isWork.value = true
  remaining.value = work.value * 60
}
function skip() {
  remaining.value = 0
  tick()
}

watch([work, breakMin], () => {
  if (!running.value) remaining.value = (isWork.value ? work.value : breakMin.value) * 60
})

onBeforeUnmount(() => {
  if (interval) clearInterval(interval)
  if (typeof document !== 'undefined') document.title = 'TextKit — Tiện ích chỉnh sửa text online'
})
</script>

<template>
  <div class="grid gap-3 grid-cols-1 lg:grid-cols-[1fr_280px]">
    <!-- Clock card -->
    <section class="flex flex-col items-center justify-center gap-5 py-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl min-h-[420px] relative overflow-hidden">
      <div class="absolute inset-x-0 top-0 h-1 bg-neutral-100 dark:bg-neutral-800">
        <div class="h-full bg-primary-500 transition-[width]" :style="{ width: `${progress * 100}%` }" />
      </div>
      <UBadge color="primary" variant="soft" size="md" class="uppercase tracking-wider">{{ mode }}</UBadge>
      <div class="font-mono font-bold text-[80px] sm:text-[112px] tracking-tighter leading-none tabular-nums">
        {{ time }}
      </div>
      <div class="flex gap-2">
        <UButton color="primary" size="lg" :icon="running ? 'i-lucide-pause' : 'i-lucide-play'" @click="toggle">
          {{ running ? 'Tạm dừng' : 'Bắt đầu' }}
        </UButton>
        <UButton variant="outline" color="neutral" size="lg" icon="i-lucide-skip-forward" @click="skip">Bỏ qua</UButton>
        <UButton variant="ghost" color="neutral" size="lg" icon="i-lucide-rotate-ccw" @click="reset">Reset</UButton>
      </div>
    </section>

    <aside class="flex flex-col gap-3 p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
      <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        Tùy chọn
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-[12.5px] font-medium">Phiên làm việc (phút)</label>
        <UInput v-model.number="work" type="number" size="sm" :min="1" :max="120" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-[12.5px] font-medium">Phiên nghỉ (phút)</label>
        <UInput v-model.number="breakMin" type="number" size="sm" :min="1" :max="60" />
      </div>
      <label class="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 cursor-pointer">
        <span class="text-[12.5px]">Âm báo khi kết thúc</span>
        <USwitch v-model="sound" size="xs" />
      </label>
    </aside>
  </div>
</template>
