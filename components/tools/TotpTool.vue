<script setup lang="ts">
const toast = useToast()

type Mode = 'single' | 'bulk'
const mode = ref<Mode>('single')

const secret = ref('')
const bulkInput = ref('')

// =============== TOTP ===============
function base32Decode(s: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const cleaned = s.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '')
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const c of cleaned) {
    const v = alphabet.indexOf(c)
    if (v === -1) continue
    value = (value << 5) | v
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(bytes)
}

async function totp(rawSecret: string, period = 30, digits = 6): Promise<string> {
  const key = base32Decode(rawSecret)
  if (key.length === 0) throw new Error('Secret không hợp lệ')
  const counter = Math.floor(Date.now() / 1000 / period)
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  view.setUint32(0, Math.floor(counter / 0x100000000))
  view.setUint32(4, counter & 0xffffffff)
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, buf))
  const offset = sig[sig.length - 1] & 0x0f
  const code =
    ((sig[offset] & 0x7f) << 24) |
    (sig[offset + 1] << 16) |
    (sig[offset + 2] << 8) |
    sig[offset + 3]
  return String(code % 10 ** digits).padStart(digits, '0')
}

// =============== State ===============
const now = ref(Math.floor(Date.now() / 1000))
const period = 30
const remaining = computed(() => period - (now.value % period))
const progress = computed(() => remaining.value / period)

const code = ref('------')
const error = ref('')
let timer: ReturnType<typeof setInterval> | null = null

async function refreshSingle() {
  if (!secret.value.trim()) {
    code.value = '------'
    error.value = ''
    return
  }
  try {
    code.value = await totp(secret.value)
    error.value = ''
  } catch (e: any) {
    code.value = '------'
    error.value = e.message
  }
}

const bulkRows = ref<{ name: string; secret: string; code: string; error?: string }[]>([])

async function refreshBulk() {
  const rows: { name: string; secret: string; code: string; error?: string }[] = []
  for (const line of bulkInput.value.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const idx = trimmed.indexOf('|')
    let name = ''
    let sec = trimmed
    if (idx >= 0) {
      name = trimmed.slice(0, idx).trim()
      sec = trimmed.slice(idx + 1).trim()
    }
    try {
      const c = await totp(sec)
      rows.push({ name: name || sec.slice(0, 8) + '…', secret: sec, code: c })
    } catch (e: any) {
      rows.push({ name: name || '?', secret: sec, code: 'lỗi', error: e.message })
    }
  }
  bulkRows.value = rows
}

async function refresh() {
  now.value = Math.floor(Date.now() / 1000)
  if (mode.value === 'single') await refreshSingle()
  else await refreshBulk()
}

onMounted(() => {
  refresh()
  timer = setInterval(refresh, 1000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

watch([mode, secret, bulkInput], refresh)

// =============== Helpers ===============
function copy(text: string) {
  if (!text || text === '------' || text === 'lỗi') return
  navigator.clipboard.writeText(text)
  toast.add({ title: `Đã copy ${text}`, color: 'success', icon: 'i-lucide-copy-check' })
}
async function pasteToSecret() {
  try {
    secret.value = (await navigator.clipboard.readText()).trim()
  } catch {}
}
async function pasteToBulk() {
  try {
    bulkInput.value = await navigator.clipboard.readText()
  } catch {}
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Mode tabs -->
    <div class="inline-flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 self-start">
      <button
        v-for="m in [{ v: 'single', l: '1 tài khoản' }, { v: 'bulk', l: 'Hàng loạt' }]"
        :key="m.v"
        type="button"
        class="px-4 py-1.5 text-[12.5px] font-medium rounded-md transition-colors"
        :class="
          mode === m.v
            ? 'bg-white dark:bg-neutral-900 text-primary-700 dark:text-primary-300 shadow-sm'
            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
        "
        @click="mode = m.v as Mode"
      >
        {{ m.l }}
      </button>
    </div>

    <!-- Single -->
    <div v-if="mode === 'single'" class="grid gap-4 grid-cols-1 lg:grid-cols-[1fr_360px]">
      <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
        <label class="text-[12.5px] font-medium block mb-2">Secret 2FA (Base32):</label>
        <div class="flex gap-2">
          <UInput
            v-model="secret"
            size="lg"
            class="flex-1"
            placeholder="JBSWY3DPEHPK3PXP"
            :ui="{ base: 'font-mono tracking-wider' }"
          />
          <UButton variant="outline" color="neutral" icon="i-lucide-clipboard" @click="pasteToSecret">Dán</UButton>
        </div>
        <div v-if="error" class="mt-2 text-[12px] text-red-600 dark:text-red-400">
          <UIcon name="i-lucide-alert-triangle" class="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
          {{ error }}
        </div>
        <div class="mt-3 text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
          <UIcon name="i-lucide-info" class="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
          Lấy secret từ QR code khi setup 2FA — bấm "Show Secret Key" hoặc "Can't scan QR" trong app gốc.
        </div>
      </section>

      <section class="flex flex-col items-center justify-center gap-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 relative overflow-hidden">
        <div class="absolute inset-x-0 top-0 h-1 bg-neutral-100 dark:bg-neutral-800">
          <div class="h-full bg-primary-500 transition-[width] duration-1000" :style="{ width: `${progress * 100}%` }" />
        </div>
        <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Mã 2FA hiện tại
        </div>
        <button
          class="font-mono font-bold text-[44px] sm:text-[56px] tracking-[0.15em] leading-none tabular-nums text-primary-600 dark:text-primary-400 hover:scale-105 transition-transform cursor-pointer select-all"
          :title="code !== '------' ? 'Bấm để copy' : ''"
          @click="copy(code)"
        >
          {{ code.slice(0, 3) }}<span class="opacity-30">·</span>{{ code.slice(3) }}
        </button>
        <div class="text-[12.5px] text-neutral-500 dark:text-neutral-400">
          Đổi sau <strong class="text-neutral-700 dark:text-neutral-300 font-mono">{{ remaining }}s</strong>
        </div>
      </section>
    </div>

    <!-- Bulk -->
    <div v-else class="flex flex-col gap-4">
      <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
        <div class="flex items-center justify-between mb-2">
          <label class="text-[12.5px] font-medium">Danh sách secret (mỗi dòng: <code class="px-1 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[11.5px]">tên|secret</code> hoặc chỉ secret):</label>
          <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-clipboard" @click="pasteToBulk">Dán</UButton>
        </div>
        <textarea
          v-model="bulkInput"
          rows="6"
          spellcheck="false"
          placeholder="Facebook|JBSWY3DPEHPK3PXP
Google|HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ
Github|NBSWY3DPEB3W64TMMQ"
          class="w-full resize-y border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 font-mono text-[13px] bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
        />
      </section>

      <section v-if="bulkRows.length" class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div class="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-between">
          <div class="text-[12.5px] font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-key-round" class="w-4 h-4 text-primary-600" />
            {{ bulkRows.length }} mã 2FA
          </div>
          <div class="text-[11px] text-neutral-500 font-mono">Đổi sau {{ remaining }}s</div>
        </div>
        <div class="divide-y divide-neutral-200 dark:divide-neutral-800">
          <div
            v-for="row in bulkRows"
            :key="row.secret"
            class="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
          >
            <div class="flex-1 min-w-0">
              <div class="font-medium text-[13px] truncate">{{ row.name }}</div>
              <div class="text-[11px] text-neutral-500 font-mono truncate">{{ row.secret }}</div>
            </div>
            <button
              v-if="!row.error"
              class="font-mono font-bold text-[20px] tracking-[0.1em] tabular-nums text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 px-3 py-1 rounded-md transition-colors"
              @click="copy(row.code)"
            >
              {{ row.code }}
            </button>
            <UBadge v-else color="error" variant="soft" size="xs" :title="row.error">Lỗi</UBadge>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
