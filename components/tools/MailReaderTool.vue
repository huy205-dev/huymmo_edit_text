<script setup lang="ts">
const toast = useToast()

type Mode = 'graph' | 'oauth2'
const mode = ref<Mode>('graph')

const bulkInput = ref('')
const top = ref(15)
const filter = ref('')
const loading = ref(false)

type Message = {
  id: string
  subject: string
  bodyPreview: string
  from?: { emailAddress?: { name?: string; address?: string } }
  receivedDateTime: string
  isRead?: boolean
  body?: { contentType: string; content: string }
}

type AccountResult = {
  email: string
  status: 'pending' | 'success' | 'error'
  error?: string
  messages?: Message[]
  /** Access token được giữ lại trong RAM để fetch body khi user click. Hết hạn sau ~1h. */
  accessToken?: string
  /** Endpoint base — Graph hoặc Outlook REST */
  apiBase?: string
  newRefreshToken?: string
  expanded?: boolean
}

const results = ref<AccountResult[]>([])
const openedMsgId = ref<string | null>(null)
const loadingBodyId = ref<string | null>(null)

// =============== OAuth2 + API ===============

// Outlook REST API v2.0 trả về PascalCase (Id, Subject, From.EmailAddress.Address...)
// trong khi Graph API trả camelCase. Normalize đệ quy về camelCase để code phía client
// xử lý thống nhất.
function normalizeKeys(v: any): any {
  if (Array.isArray(v)) return v.map(normalizeKeys)
  if (v && typeof v === 'object') {
    const out: any = {}
    for (const k of Object.keys(v)) {
      const nk = k.charAt(0).toLowerCase() + k.slice(1)
      out[nk] = normalizeKeys(v[k])
    }
    return out
  }
  return v
}

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0/me/messages'
const OUTLOOK_BASE = 'https://outlook.office.com/api/v2.0/me/messages'

// Các refresh_token combo Hotmail thường do Microsoft Authentication Broker
// (client_id 9e5f94bc-…) cấp dưới dạng Family Refresh Token: chỉ đổi được sang
// những scope đã được consent sẵn. Yêu cầu một scope cứng (vd Mail.Read) mà token
// không có sẽ bị từ chối với AADSTS70000 ("scopes unauthorized").
//
// Vì vậy ta thử lần lượt một danh sách scope, ưu tiên `.default` — nghĩa là "cấp
// access_token cho MỌI scope đã consent của resource này", nên không bao giờ kích
// AADSTS70000. Cái nào lấy được access_token trước thì dùng, kèm API base tương ứng.
type ScopeAttempt = { scope: string; base: string }
const GRAPH_ATTEMPTS: ScopeAttempt[] = [
  { scope: 'https://graph.microsoft.com/.default offline_access', base: GRAPH_BASE },
  { scope: 'https://graph.microsoft.com/Mail.Read offline_access', base: GRAPH_BASE },
  { scope: 'https://outlook.office.com/.default offline_access', base: OUTLOOK_BASE },
  { scope: 'https://outlook.office.com/Mail.Read offline_access', base: OUTLOOK_BASE }
]
const OUTLOOK_ATTEMPTS: ScopeAttempt[] = [
  { scope: 'https://outlook.office.com/.default offline_access', base: OUTLOOK_BASE },
  { scope: 'https://outlook.office.com/Mail.Read offline_access', base: OUTLOOK_BASE },
  { scope: 'https://graph.microsoft.com/.default offline_access', base: GRAPH_BASE },
  { scope: 'https://graph.microsoft.com/Mail.Read offline_access', base: GRAPH_BASE }
]

async function readGraphOrOAuth(line: string, useGraph: boolean): Promise<AccountResult> {
  const parts = line.split('|').map((s) => s.trim())
  const [email, , refreshToken, clientId] = parts // email | password | refresh_token | client_id
  if (!email || !refreshToken || !clientId) {
    return { email: email || '?', status: 'error', error: 'Thiếu trường (cần email|password|refresh_token|client_id)' }
  }

  // Step 1: refresh_token → access_token. Thử lần lượt các scope tới khi thành công.
  const attempts = useGraph ? GRAPH_ATTEMPTS : OUTLOOK_ATTEMPTS
  let access = ''
  let newRefresh = ''
  let apiBase = ''
  let firstErr = ''
  for (const attempt of attempts) {
    try {
      // Gọi server proxy /api/oauth-token thay vì login.microsoftonline.com trực tiếp
      // (Microsoft chặn CORS với client_id không phải SPA — lỗi AADSTS90023).
      const r = await fetch('/api/oauth-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          refresh_token: refreshToken,
          scope: attempt.scope
        })
      })
      const j: any = await r.json().catch(() => ({}))
      if (r.ok && j.access_token) {
        access = j.access_token
        newRefresh = j.refresh_token
        apiBase = attempt.base
        break
      }
      const msg = j.error_description || j.error || `Token HTTP ${r.status}`
      if (!firstErr) firstErr = msg
      // Không break sớm: AADSTS70000 ("scope unauthorized") cũng trả error=invalid_grant,
      // nên phải thử hết các scope/resource còn lại — token có thể chỉ consent 1 trong 2.
    } catch (e: any) {
      if (!firstErr) firstErr = `OAuth2: ${e.message}`
    }
  }
  if (!access) return { email, status: 'error', error: firstErr || 'Không lấy được access_token' }

  // Step 2: gọi Mail API. useGraph phụ thuộc endpoint thực tế đã lấy được token.
  const useGraphApi = apiBase === GRAPH_BASE
  // Outlook REST cần PascalCase trong $select; Graph dùng camelCase.
  const selectFields = useGraphApi
    ? 'id,subject,bodyPreview,from,receivedDateTime,isRead'
    : 'Id,Subject,BodyPreview,From,ReceivedDateTime,IsRead'
  const orderField = useGraphApi ? 'receivedDateTime desc' : 'ReceivedDateTime desc'
  const params = new URLSearchParams({
    $top: String(Math.max(1, Math.min(50, top.value))),
    $select: selectFields,
    $orderby: orderField
  })
  if (filter.value.trim()) params.set('$search', `"${filter.value.trim()}"`)
  try {
    const r = await fetch(`${apiBase}?${params}`, {
      headers: { Authorization: `Bearer ${access}` }
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) {
      const err = useGraphApi ? j.error?.message : (j.error?.message || j['odata.error']?.message?.value)
      return { email, status: 'error', error: err || `Mail HTTP ${r.status}` }
    }
    // Outlook REST trả PascalCase → normalize về camelCase để dùng chung Message type
    const rawMessages = j.value || []
    const messages = useGraphApi ? rawMessages : normalizeKeys(rawMessages)
    return {
      email,
      status: 'success',
      messages,
      accessToken: access,
      apiBase,
      newRefreshToken: newRefresh
    }
  } catch (e: any) {
    return { email, status: 'error', error: `Mail API: ${e.message}` }
  }
}

// Fetch full body of a single message on demand using stored access token.
async function loadMessageBody(account: AccountResult, msgId: string) {
  if (!account.accessToken || !account.apiBase) return
  const msg = account.messages?.find((m) => m.id === msgId)
  if (!msg || msg.body) return
  const isOutlook = account.apiBase.includes('outlook.office.com')
  loadingBodyId.value = msgId
  try {
    const select = isOutlook ? 'Id,Subject,Body,BodyPreview,From,ReceivedDateTime' : 'id,subject,body,bodyPreview,from,receivedDateTime'
    const r = await fetch(`${account.apiBase}/${encodeURIComponent(msgId)}?$select=${select}`, {
      headers: { Authorization: `Bearer ${account.accessToken}` }
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) {
      const err = j.error?.message || j['odata.error']?.message?.value || `HTTP ${r.status}`
      toast.add({ title: `Không tải được nội dung email`, description: err, color: 'error' })
      return
    }
    const normalized = isOutlook ? normalizeKeys(j) : j
    msg.body = normalized.body
  } catch (e: any) {
    toast.add({ title: 'Lỗi mạng', description: e.message, color: 'error' })
  } finally {
    loadingBodyId.value = null
  }
}

function toggleMessage(account: AccountResult, msgId: string) {
  if (openedMsgId.value === msgId) {
    openedMsgId.value = null
    return
  }
  openedMsgId.value = msgId
  loadMessageBody(account, msgId)
}

// Quick OTP / code extraction for the typical use case (FB, Gmail OTP...)
function extractCodes(text: string): string[] {
  if (!text) return []
  const codes = new Set<string>()
  // Common pattern: 4-8 digit codes
  const matches = text.match(/\b\d{4,8}\b/g) || []
  for (const m of matches) {
    if (m.length >= 4 && m.length <= 8) codes.add(m)
  }
  return [...codes]
}

// Copy 1 mã (dùng chung cho badge & cột code bên phải). Template Vue không truy cập
// được `navigator` global nên phải gọi qua method này.
async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    toast.add({ title: `Đã copy ${code}`, color: 'success', icon: 'i-lucide-copy-check' })
  } catch {
    toast.add({ title: 'Không copy được mã', color: 'error' })
  }
}

async function copyBody(content: string) {
  try {
    await navigator.clipboard.writeText(content)
    toast.add({ title: 'Đã copy nội dung email', color: 'success', icon: 'i-lucide-copy-check' })
  } catch {
    toast.add({ title: 'Không copy được nội dung', color: 'error' })
  }
}

// =============== Run ===============
async function run() {
  loading.value = true
  results.value = []
  openedMsgId.value = null

  const lines = bulkInput.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) {
    toast.add({ title: 'Vui lòng nhập danh sách email', color: 'warning' })
    loading.value = false
    return
  }

  // Khởi tạo placeholder để user thấy progress
  results.value = lines.map((l) => ({ email: l.split('|')[0].trim(), status: 'pending' as const }))

  // Chạy parallel với concurrency limit = 5
  const limit = 5
  let cursor = 0
  async function worker() {
    while (cursor < lines.length) {
      const i = cursor++
      const r = await readGraphOrOAuth(lines[i], mode.value === 'graph')
      results.value[i] = r
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, lines.length) }, worker))
  loading.value = false

  const ok = results.value.filter((r) => r.status === 'success').length
  toast.add({
    title: `Hoàn tất: ${ok}/${results.value.length} thành công`,
    color: ok ? 'success' : 'warning',
    icon: 'i-lucide-mail-check'
  })
}

// =============== Helpers ===============
function fmtDate(s: string) {
  if (!s) return ''
  try {
    const d = new Date(s)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    if (sameDay) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return s
  }
}
async function paste() {
  try {
    bulkInput.value = await navigator.clipboard.readText()
  } catch {}
}
function copyResults() {
  const text = results.value
    .map((r) => {
      if (r.status !== 'success') return `${r.email} → ❌ ${r.error || 'lỗi'}`
      const lines = (r.messages || [])
        .map((m) => `  • ${fmtDate(m.receivedDateTime)} | ${m.from?.emailAddress?.address || '?'} | ${m.subject}`)
        .join('\n')
      return `${r.email} → ✅ ${r.messages?.length || 0} email\n${lines}`
    })
    .join('\n\n')
  navigator.clipboard.writeText(text)
  toast.add({ title: 'Đã copy kết quả', color: 'success', icon: 'i-lucide-copy-check' })
}
function copyNewTokens() {
  const text = results.value
    .filter((r) => r.status === 'success' && r.newRefreshToken)
    .map((r) => `${r.email}|${r.newRefreshToken}`)
    .join('\n')
  if (!text) return toast.add({ title: 'Không có refresh_token mới', color: 'warning' })
  navigator.clipboard.writeText(text)
  toast.add({ title: 'Đã copy refresh_token mới', color: 'success', icon: 'i-lucide-key-round' })
}
function toggleExpand(idx: number) {
  results.value[idx].expanded = !results.value[idx].expanded
}

const stats = computed(() => {
  const total = results.value.length
  const ok = results.value.filter((r) => r.status === 'success').length
  const err = results.value.filter((r) => r.status === 'error').length
  const totalMail = results.value.reduce((sum, r) => sum + (r.messages?.length || 0), 0)
  return { total, ok, err, totalMail }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Mode toggle (Graph API / OAuth2) -->
    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 lg:p-5">
      <div class="text-[12.5px] font-semibold mb-3">Phương thức</div>
      <div class="flex flex-wrap gap-3">
        <label
          v-for="m in [
            { v: 'graph',  l: 'Graph API' },
            { v: 'oauth2', l: 'OAuth2' }
          ]"
          :key="m.v"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all"
          :class="
            mode === m.v
              ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-300 dark:border-primary-500/40 text-primary-800 dark:text-primary-200'
              : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600'
          "
        >
          <div
            class="w-5 h-5 rounded-md border-2 grid place-items-center transition-colors shrink-0"
            :class="
              mode === m.v
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'bg-transparent border-neutral-300 dark:border-neutral-600'
            "
          >
            <UIcon v-if="mode === m.v" name="i-lucide-check" class="w-3.5 h-3.5" />
          </div>
          <input type="radio" name="mail-mode" :value="m.v" v-model="mode" class="hidden" />
          <div class="font-semibold text-[13px]">{{ m.l }}</div>
        </label>
      </div>
    </section>

    <!-- Input -->
    <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 lg:p-5">
      <div class="flex items-center justify-between mb-2">
        <label class="text-[12.5px] font-semibold">
          Nhập Email <span class="text-neutral-500 font-normal">— mỗi dòng một tài khoản</span>
        </label>
        <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-clipboard" @click="paste">Dán</UButton>
      </div>

      <textarea
        v-model="bulkInput"
        rows="8"
        spellcheck="false"
        placeholder="email1@hotmail.com|password1|M.AAA-...|9e5f94bc-...
email2@outlook.com|password2|M.BBB-...|9e5f94bc-...
email3@hotmail.com|password3|M.CCC-...|9e5f94bc-..."
        class="w-full resize-y border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 font-mono text-[12.5px] leading-relaxed bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
      />

      <!-- Filter row -->
      <div class="mt-3 grid gap-3 grid-cols-1 sm:grid-cols-[1fr_120px_auto]">
        <UInput v-model="filter" size="md" icon="i-lucide-search" placeholder="Lọc theo từ khóa (subject hoặc nội dung)" />
        <UInput v-model.number="top" type="number" size="md" :min="1" :max="50" placeholder="Số email/tài khoản" />
        <UButton
          color="primary"
          size="md"
          icon="i-lucide-mail-search"
          :loading="loading"
          @click="run"
        >
          Đọc hòm thư
        </UButton>
      </div>
    </section>

    <!-- Stats -->
    <section v-if="results.length" class="flex flex-wrap items-center gap-2 px-1">
      <UBadge color="primary" variant="soft" size="md">
        <UIcon name="i-lucide-list" class="w-3.5 h-3.5" />
        <span class="ml-1">{{ stats.total }} tài khoản</span>
      </UBadge>
      <UBadge color="success" variant="soft" size="md">
        <UIcon name="i-lucide-check-circle-2" class="w-3.5 h-3.5" />
        <span class="ml-1">{{ stats.ok }} OK</span>
      </UBadge>
      <UBadge v-if="stats.err" color="error" variant="soft" size="md">
        <UIcon name="i-lucide-x-circle" class="w-3.5 h-3.5" />
        <span class="ml-1">{{ stats.err }} lỗi</span>
      </UBadge>
      <UBadge color="info" variant="soft" size="md">
        <UIcon name="i-lucide-mail" class="w-3.5 h-3.5" />
        <span class="ml-1">{{ stats.totalMail }} email</span>
      </UBadge>
      <div class="flex-1" />
      <UButton variant="outline" color="neutral" size="xs" icon="i-lucide-clipboard-copy" @click="copyResults">Copy kết quả</UButton>
      <UButton variant="outline" color="neutral" size="xs" icon="i-lucide-key-round" @click="copyNewTokens">Copy refresh_token mới</UButton>
    </section>

    <!-- Results -->
    <section
      v-for="(r, idx) in results"
      :key="r.email + idx"
      class="bg-white dark:bg-neutral-900 border rounded-xl overflow-hidden"
      :class="
        r.status === 'pending'
          ? 'border-neutral-200 dark:border-neutral-800'
          : r.status === 'success'
            ? 'border-primary-200 dark:border-primary-500/30'
            : 'border-red-200 dark:border-red-500/30'
      "
    >
      <button
        type="button"
        class="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
        @click="r.status === 'success' && toggleExpand(idx)"
      >
        <div class="w-8 h-8 grid place-items-center rounded-full text-white font-bold text-[12px] shrink-0"
          :style="{ background: `oklch(60% 0.15 ${[...r.email].reduce((h,c)=>(h*31+c.charCodeAt(0))%360,0)})` }"
        >
          {{ (r.email || '?').charAt(0).toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-[13.5px] truncate">{{ r.email }}</div>
          <div v-if="r.status === 'pending'" class="text-[12px] text-neutral-500 inline-flex items-center gap-1">
            <UIcon name="i-lucide-loader-2" class="w-3 h-3 animate-spin" />
            Đang xử lý…
          </div>
          <div v-else-if="r.status === 'error'" class="text-[12px] text-red-600 dark:text-red-400 truncate" :title="r.error">
            <UIcon name="i-lucide-alert-triangle" class="w-3 h-3 inline -mt-0.5 mr-1" />
            {{ r.error }}
          </div>
          <div v-else class="text-[12px] text-neutral-500 dark:text-neutral-400">
            <UIcon name="i-lucide-check" class="w-3 h-3 inline -mt-0.5 mr-1 text-primary-600" />
            {{ r.messages?.length || 0 }} email — bấm để xem
          </div>
        </div>
        <UIcon
          v-if="r.status === 'success'"
          :name="r.expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="w-4 h-4 text-neutral-400"
        />
      </button>

      <div v-if="r.expanded && r.messages?.length" class="border-t border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
        <template v-for="m in r.messages" :key="m.id">
          <button
            type="button"
            class="w-full text-left flex items-start gap-3 px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
            :class="!m.isRead ? 'bg-blue-50/30 dark:bg-blue-500/5' : ''"
            @click="toggleMessage(r, m.id)"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-2">
                <div class="font-medium text-[12.5px] truncate" :class="!m.isRead ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-700 dark:text-neutral-300'">
                  {{ m.from?.emailAddress?.name || m.from?.emailAddress?.address || '?' }}
                </div>
                <div class="flex-1" />
                <div class="text-[11px] text-neutral-500 shrink-0 font-mono">{{ fmtDate(m.receivedDateTime) }}</div>
              </div>
              <div class="text-[12.5px] truncate mt-0.5" :class="!m.isRead ? 'font-semibold' : ''">{{ m.subject || '(không tiêu đề)' }}</div>
              <div class="text-[11.5px] text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                {{ m.bodyPreview || '—' }}
              </div>
              <!-- Các mã phụ (nếu email chứa nhiều số) -->
              <div v-if="extractCodes(m.subject + ' ' + m.bodyPreview).length > 1" class="flex flex-wrap gap-1 mt-1">
                <UBadge
                  v-for="c in extractCodes(m.subject + ' ' + m.bodyPreview).slice(1)"
                  :key="c"
                  color="warning"
                  variant="soft"
                  size="xs"
                  class="font-mono cursor-pointer"
                  @click.stop="copyCode(c)"
                >
                  <UIcon name="i-lucide-key" class="w-3 h-3" />
                  {{ c }}
                </UBadge>
              </div>
            </div>

            <!-- Cột code (OTP) bên phải + copy nhanh -->
            <div
              v-if="extractCodes(m.subject + ' ' + m.bodyPreview).length"
              class="shrink-0 self-center"
              @click.stop="copyCode(extractCodes(m.subject + ' ' + m.bodyPreview)[0])"
            >
              <span
                class="inline-flex items-center gap-1.5 font-mono text-[14px] font-bold tracking-wide px-3 py-1.5 rounded-lg border cursor-pointer transition-colors select-all
                       bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300
                       border-amber-300/70 dark:border-amber-500/30
                       hover:bg-amber-200 dark:hover:bg-amber-500/25"
                :title="`Bấm để copy ${extractCodes(m.subject + ' ' + m.bodyPreview)[0]}`"
              >
                {{ extractCodes(m.subject + ' ' + m.bodyPreview)[0] }}
                <UIcon name="i-lucide-copy" class="w-3.5 h-3.5 opacity-70" />
              </span>
            </div>

            <UIcon
              :name="openedMsgId === m.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="w-4 h-4 text-neutral-400 mt-1 shrink-0 self-center"
            />
          </button>

          <!-- Email body expanded -->
          <div
            v-if="openedMsgId === m.id"
            class="px-4 pb-4 pt-2 bg-neutral-50/60 dark:bg-neutral-900/40 border-t border-neutral-200 dark:border-neutral-800"
          >
            <div v-if="loadingBodyId === m.id" class="text-[12.5px] text-neutral-500 inline-flex items-center gap-2 py-3">
              <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
              Đang tải nội dung email…
            </div>
            <div v-else-if="m.body" class="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 overflow-hidden">
              <iframe
                v-if="m.body.contentType === 'html' || m.body.contentType === 'HTML'"
                :srcdoc="m.body.content"
                sandbox=""
                referrerpolicy="no-referrer"
                class="w-full min-h-[320px] border-0"
              />
              <pre v-else class="text-[12.5px] whitespace-pre-wrap leading-relaxed p-3 max-h-[480px] overflow-auto">{{ m.body.content }}</pre>
            </div>
            <div v-else class="text-[12px] text-neutral-500 italic py-3">Không có nội dung</div>

            <!-- Action row in expanded body -->
            <div v-if="m.body" class="mt-2 flex flex-wrap items-center gap-2">
              <UBadge
                v-for="c in extractCodes((m.body.content || '').replace(/<[^>]+>/g, ' '))"
                :key="c"
                color="warning"
                variant="soft"
                size="sm"
                class="font-mono cursor-pointer"
                @click="copyCode(c)"
              >
                <UIcon name="i-lucide-key" class="w-3 h-3" />
                {{ c }}
              </UBadge>
              <div class="flex-1" />
              <UButton
                variant="ghost"
                color="neutral"
                size="xs"
                icon="i-lucide-copy"
                @click="copyBody(m.body!.content)"
              >
                Copy nội dung
              </UButton>
            </div>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
