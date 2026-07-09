<script setup lang="ts">
const toast = useToast()

type IpInfo = {
  ipv4?: string
  ipv6?: string
  city?: string
  region?: string
  country_name?: string
  country_code?: string
  postal?: string
  latitude?: number
  longitude?: number
  timezone?: string
  org?: string
  asn?: string
  network?: string
}

const data = ref<IpInfo | null>(null)
const loading = ref(true)
const errMsg = ref('')

// Fetch IPv4 from a v4-only endpoint
async function getV4(): Promise<string | null> {
  // api.ipify.org has IPv4-only A records
  try {
    const r = await fetch('https://api.ipify.org?format=json')
    if (r.ok) {
      const j = await r.json()
      if (j.ip && j.ip.includes('.')) return j.ip
    }
  } catch {}
  // ipv4.icanhazip.com — IPv4-only host
  try {
    const r = await fetch('https://ipv4.icanhazip.com/')
    if (r.ok) {
      const t = (await r.text()).trim()
      if (t.includes('.')) return t
    }
  } catch {}
  return null
}

// Fetch IPv6 from a v6-only endpoint (returns null if user has no IPv6)
async function getV6(): Promise<string | null> {
  try {
    const r = await fetch('https://api6.ipify.org?format=json')
    if (r.ok) {
      const j = await r.json()
      if (j.ip && j.ip.includes(':')) return j.ip
    }
  } catch {}
  try {
    const r = await fetch('https://ipv6.icanhazip.com/')
    if (r.ok) {
      const t = (await r.text()).trim()
      if (t.includes(':')) return t
    }
  } catch {}
  return null
}

// Country code → name (a few common ones; "country" field từ Cloudflare là ISO 2 letters).
const COUNTRY_NAMES: Record<string, string> = {
  VN: 'Vietnam', US: 'United States', JP: 'Japan', KR: 'South Korea', CN: 'China',
  TH: 'Thailand', SG: 'Singapore', MY: 'Malaysia', ID: 'Indonesia', PH: 'Philippines',
  GB: 'United Kingdom', DE: 'Germany', FR: 'France', AU: 'Australia', IN: 'India',
  CA: 'Canada', BR: 'Brazil', RU: 'Russia', IT: 'Italy', ES: 'Spain', NL: 'Netherlands',
  TW: 'Taiwan', HK: 'Hong Kong', LA: 'Laos', KH: 'Cambodia'
}

// Cloudflare's hidden meta endpoint — same source j2team.org uses.
// Returns: clientIp, asn, asOrganization, country, city, region, postalCode, latitude, longitude.
// CORS: Access-Control-Allow-Origin: * — works from any browser origin (cần UA, browser tự gửi).
async function getCloudflareMeta(): Promise<Partial<IpInfo>> {
  try {
    const r = await fetch('https://speed.cloudflare.com/meta')
    if (r.ok) {
      const j: any = await r.json()
      if (j && j.clientIp) {
        return {
          city: j.city,
          region: j.region,
          country_code: j.country,
          country_name: COUNTRY_NAMES[j.country] || j.country,
          postal: j.postalCode,
          latitude: j.latitude ? parseFloat(j.latitude) : undefined,
          longitude: j.longitude ? parseFloat(j.longitude) : undefined,
          org: j.asOrganization,
          asn: j.asn ? `AS${j.asn}` : ''
        }
      }
    }
  } catch {}
  return {}
}

// Backup: ip.guide (CORS-enabled, free) — chỉ dùng nếu Cloudflare fail.
async function getIpGuide(ip: string): Promise<Partial<IpInfo>> {
  try {
    const r = await fetch(`https://ip.guide/${ip}`)
    if (r.ok) {
      const j: any = await r.json()
      if (j && j.network) {
        const as = j.network.autonomous_system
        return {
          org: as?.organization,
          asn: as?.asn ? `AS${as.asn}` : '',
          network: j.network.cidr,
          country_name: j.location?.country,
          city: j.location?.city || undefined,
          latitude: j.location?.latitude,
          longitude: j.location?.longitude,
          timezone: j.location?.timezone
        }
      }
    }
  } catch {}
  return {}
}

function mergeInfo(...sources: Partial<IpInfo>[]): Partial<IpInfo> {
  const out: Partial<IpInfo> = {}
  for (const s of sources) {
    for (const k of Object.keys(s) as (keyof IpInfo)[]) {
      const v = s[k]
      if (v !== undefined && v !== null && v !== '' && (out[k] === undefined || out[k] === '')) {
        ;(out as any)[k] = v
      }
    }
  }
  return out
}

async function fetchIp() {
  loading.value = true
  errMsg.value = ''

  // Chạy song song:
  //  - speed.cloudflare.com/meta → ASN + ISP + geo (Cloudflare network — chính xác nhất)
  //  - api.ipify.org → IPv4 (qua host A-only)
  //  - api6.ipify.org → IPv6 (qua host AAAA-only)
  const [meta, v4, v6] = await Promise.all([getCloudflareMeta(), getV4(), getV6()])

  if (!v4 && !v6 && !Object.keys(meta).length) {
    errMsg.value = 'Không lấy được IP — kiểm tra mạng / adblock đang chặn các API.'
    loading.value = false
    return
  }

  // ip.guide bổ sung những gì Cloudflare meta thiếu: network (CIDR) + timezone.
  // Ưu tiên Cloudflare cho các trường trùng (chính xác hơn cho mạng hiện tại).
  const target = v4 || v6 || ''
  const guide = target ? await getIpGuide(target) : {}
  const info = mergeInfo(meta, guide)

  data.value = { ipv4: v4 || undefined, ipv6: v6 || undefined, ...info }
  loading.value = false
}

onMounted(fetchIp)

// Browser/OS parsing from UA
const ua = computed(() => (typeof navigator !== 'undefined' ? navigator.userAgent : ''))
const browser = computed(() => {
  const u = ua.value
  if (/Edg\//i.test(u)) return 'Microsoft Edge'
  if (/OPR|Opera/i.test(u)) return 'Opera'
  if (/Chrome\//i.test(u) && !/Edg\//.test(u)) return 'Chrome'
  if (/Safari\//i.test(u) && !/Chrome\//.test(u)) return 'Safari'
  if (/Firefox\//i.test(u)) return 'Firefox'
  return 'Khác'
})
const os = computed(() => {
  const u = ua.value
  if (/Mac OS X/i.test(u)) return 'macOS'
  if (/Windows NT 10/i.test(u)) return 'Windows 10/11'
  if (/Windows/i.test(u)) return 'Windows'
  if (/Android/i.test(u)) return 'Android'
  if (/iPhone|iPad/i.test(u)) return 'iOS'
  if (/Linux/i.test(u)) return 'Linux'
  return 'Khác'
})
const screen = computed(() => {
  if (typeof window === 'undefined') return ''
  return `${window.screen.width}×${window.screen.height} @ ${window.devicePixelRatio}x`
})
const lang = computed(() => (typeof navigator !== 'undefined' ? navigator.language : ''))
const tz = computed(() => Intl.DateTimeFormat().resolvedOptions().timeZone)

function copy(text: string) {
  if (!text) return
  navigator.clipboard.writeText(text)
  toast.add({ title: `Đã copy ${text}`, color: 'success', icon: 'i-lucide-copy-check' })
}

const flag = computed(() => {
  const cc = (data.value?.country_code || data.value?.country || '').toUpperCase()
  if (cc.length !== 2) return ''
  return String.fromCodePoint(...cc.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Hero IP card -->
    <section class="bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-primary-500/10 dark:via-neutral-900 dark:to-primary-500/10 border border-primary-200 dark:border-primary-500/30 rounded-xl p-6 lg:p-8 relative overflow-hidden">
      <div class="absolute top-0 right-0 text-[200px] leading-none opacity-10 font-bold tracking-tighter select-none pointer-events-none">
        IP
      </div>
      <div class="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div class="flex items-center gap-2">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-400">
            IP công khai của bạn
          </div>
          <div v-if="flag" class="text-[20px] leading-none">{{ flag }}</div>
          <div v-if="data?.country_name" class="text-[12.5px] text-neutral-600 dark:text-neutral-400">
            {{ data.country_name }}
          </div>
        </div>
        <UButton variant="outline" color="neutral" size="sm" icon="i-lucide-refresh-cw" :loading="loading" @click="fetchIp">
          Làm mới
        </UButton>
      </div>

      <div v-if="loading" class="flex items-center gap-2 text-neutral-500">
        <UIcon name="i-lucide-loader-2" class="w-5 h-5 animate-spin" />
        Đang lấy thông tin...
      </div>
      <div v-else-if="errMsg" class="text-red-600 dark:text-red-400">
        <UIcon name="i-lucide-alert-triangle" class="w-4 h-4 inline -mt-0.5 mr-1" />
        {{ errMsg }}
      </div>
      <div v-else class="grid gap-3 grid-cols-1 lg:grid-cols-2 relative">
        <!-- IPv4 -->
        <div class="flex items-center gap-3">
          <UBadge color="primary" variant="solid" size="md" class="font-mono shrink-0">IPv4</UBadge>
          <button
            v-if="data?.ipv4"
            class="font-mono font-bold text-[24px] sm:text-[32px] leading-none tracking-tight text-left cursor-pointer hover:text-primary-700 dark:hover:text-primary-300 transition-colors truncate"
            :title="`Bấm để copy ${data.ipv4}`"
            @click="copy(data.ipv4)"
          >
            {{ data.ipv4 }}
          </button>
          <span v-else class="text-neutral-400 italic text-[14px]">không có</span>
        </div>

        <!-- IPv6 -->
        <div class="flex items-center gap-3 min-w-0">
          <UBadge color="info" variant="solid" size="md" class="font-mono shrink-0">IPv6</UBadge>
          <button
            v-if="data?.ipv6"
            class="font-mono font-semibold text-[14px] sm:text-[16px] leading-tight tracking-tight text-left cursor-pointer hover:text-primary-700 dark:hover:text-primary-300 transition-colors truncate min-w-0 flex-1"
            :title="`Bấm để copy ${data.ipv6}`"
            @click="copy(data.ipv6)"
          >
            {{ data.ipv6 }}
          </button>
          <span v-else class="text-neutral-400 italic text-[14px]">không có (mạng không hỗ trợ)</span>
        </div>
      </div>
    </section>

    <!-- Geo + Network -->
    <div class="grid gap-3 grid-cols-1 lg:grid-cols-2">
      <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
        <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-map-pin" class="w-3.5 h-3.5" />
          Vị trí
        </div>
        <dl class="grid grid-cols-[120px_1fr] gap-y-2 gap-x-3 text-[13px]">
          <dt class="text-neutral-500 dark:text-neutral-400">Quốc gia</dt>
          <dd class="font-medium">{{ data?.country_name || '—' }} <span v-if="data?.country_code" class="text-neutral-500">({{ data.country_code }})</span></dd>
          <dt class="text-neutral-500 dark:text-neutral-400">Thành phố</dt>
          <dd>{{ data?.city || '—' }}</dd>
          <dt class="text-neutral-500 dark:text-neutral-400">Vùng</dt>
          <dd>{{ data?.region || '—' }}</dd>
          <dt class="text-neutral-500 dark:text-neutral-400">Mã bưu điện</dt>
          <dd>{{ data?.postal || '—' }}</dd>
          <dt class="text-neutral-500 dark:text-neutral-400">Tọa độ</dt>
          <dd v-if="data?.latitude" class="font-mono text-[12px]">
            <a :href="`https://www.google.com/maps?q=${data.latitude},${data.longitude}`" target="_blank" class="hover:text-primary-600 underline-offset-2 hover:underline">
              {{ data.latitude }}, {{ data.longitude }}
            </a>
          </dd>
          <dd v-else>—</dd>
          <dt class="text-neutral-500 dark:text-neutral-400">Múi giờ</dt>
          <dd class="font-mono text-[12px]">{{ data?.timezone || '—' }}</dd>
        </dl>
      </section>

      <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
        <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-network" class="w-3.5 h-3.5" />
          Mạng
        </div>
        <dl class="grid grid-cols-[120px_1fr] gap-y-2 gap-x-3 text-[13px]">
          <dt class="text-neutral-500 dark:text-neutral-400">ISP</dt>
          <dd class="font-medium">{{ data?.org || '—' }}</dd>
          <dt class="text-neutral-500 dark:text-neutral-400">ASN</dt>
          <dd class="font-mono text-[12px]">{{ data?.asn || '—' }}</dd>
          <dt class="text-neutral-500 dark:text-neutral-400">Network</dt>
          <dd class="font-mono text-[12px]">{{ data?.network || '—' }}</dd>
        </dl>
      </section>
    </div>

    <!-- Browser info -->
    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
      <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3 flex items-center gap-2">
        <UIcon name="i-lucide-monitor" class="w-3.5 h-3.5" />
        Trình duyệt
      </div>
      <dl class="grid grid-cols-[140px_1fr] gap-y-2 gap-x-3 text-[13px]">
        <dt class="text-neutral-500 dark:text-neutral-400">Trình duyệt</dt>
        <dd class="font-medium">{{ browser }}</dd>
        <dt class="text-neutral-500 dark:text-neutral-400">Hệ điều hành</dt>
        <dd>{{ os }}</dd>
        <dt class="text-neutral-500 dark:text-neutral-400">Màn hình</dt>
        <dd class="font-mono text-[12px]">{{ screen }}</dd>
        <dt class="text-neutral-500 dark:text-neutral-400">Ngôn ngữ</dt>
        <dd class="font-mono text-[12px]">{{ lang }}</dd>
        <dt class="text-neutral-500 dark:text-neutral-400">Múi giờ máy</dt>
        <dd class="font-mono text-[12px]">{{ tz }}</dd>
        <dt class="text-neutral-500 dark:text-neutral-400">User-Agent</dt>
        <dd class="font-mono text-[11.5px] break-all leading-relaxed text-neutral-600 dark:text-neutral-400">{{ ua }}</dd>
      </dl>
    </section>

    <div class="text-[11.5px] text-neutral-500 dark:text-neutral-400 text-center">
      <UIcon name="i-lucide-info" class="w-3 h-3 inline -mt-0.5 mr-1" />
      Dữ liệu chính từ <code class="font-mono">speed.cloudflare.com/meta</code> (Cloudflare network) — fallback ip.guide khi cần.
    </div>
  </div>
</template>
