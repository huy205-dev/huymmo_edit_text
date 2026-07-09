<script setup lang="ts">
const toast = useToast()

type Tab = 'jwt' | 'authurl' | 'apicall'
const tab = ref<Tab>('jwt')

// =============== JWT Decode ===============
const jwtToken = ref('')
const jwtParts = computed(() => jwtToken.value.trim().split('.'))

function b64urlDecode(s: string): string {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  try {
    const bin = atob(s)
    // utf-8 decode
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

const jwtHeader = computed(() => {
  const p = jwtParts.value[0]
  if (!p) return null
  try { return JSON.parse(b64urlDecode(p)) } catch { return null }
})
const jwtPayload = computed(() => {
  const p = jwtParts.value[1]
  if (!p) return null
  try { return JSON.parse(b64urlDecode(p)) } catch { return null }
})
const jwtSignature = computed(() => jwtParts.value[2] || '')

const expInfo = computed(() => {
  const p = jwtPayload.value
  if (!p) return null
  const out: { iat?: string; exp?: string; expired?: boolean; remaining?: string } = {}
  if (p.iat) out.iat = new Date(p.iat * 1000).toLocaleString('vi-VN')
  if (p.exp) {
    out.exp = new Date(p.exp * 1000).toLocaleString('vi-VN')
    const sec = p.exp - Math.floor(Date.now() / 1000)
    out.expired = sec <= 0
    if (sec > 0) {
      if (sec < 60) out.remaining = `${sec}s`
      else if (sec < 3600) out.remaining = `${Math.floor(sec / 60)}m`
      else if (sec < 86400) out.remaining = `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
      else out.remaining = `${Math.floor(sec / 86400)} ngày`
    } else {
      out.remaining = `hết hạn ${-Math.floor(sec / 60)}m trước`
    }
  }
  return out
})

// =============== OAuth Authorize URL Builder ===============
const oauth = reactive({
  authEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  clientId: '',
  redirectUri: typeof window !== 'undefined' ? window.location.origin + '/oauth-helper' : '',
  scope: 'openid profile offline_access Mail.Read',
  responseType: 'code',
  state: '',
  codeChallenge: '',
  codeChallengeMethod: 'S256',
  prompt: ''
})

const authorizeUrl = computed(() => {
  if (!oauth.authEndpoint) return ''
  const u = new URL(oauth.authEndpoint)
  if (oauth.clientId) u.searchParams.set('client_id', oauth.clientId)
  if (oauth.redirectUri) u.searchParams.set('redirect_uri', oauth.redirectUri)
  if (oauth.responseType) u.searchParams.set('response_type', oauth.responseType)
  if (oauth.scope) u.searchParams.set('scope', oauth.scope)
  if (oauth.state) u.searchParams.set('state', oauth.state)
  if (oauth.codeChallenge) {
    u.searchParams.set('code_challenge', oauth.codeChallenge)
    u.searchParams.set('code_challenge_method', oauth.codeChallengeMethod)
  }
  if (oauth.prompt) u.searchParams.set('prompt', oauth.prompt)
  return u.toString()
})

function presetMicrosoft() {
  oauth.authEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
  oauth.scope = 'openid profile offline_access Mail.Read'
  oauth.responseType = 'code'
}
function presetGoogle() {
  oauth.authEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth'
  oauth.scope = 'openid profile email'
  oauth.responseType = 'code'
}
function presetFacebook() {
  oauth.authEndpoint = 'https://www.facebook.com/v18.0/dialog/oauth'
  oauth.scope = 'public_profile,email'
  oauth.responseType = 'code'
}

async function genState() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  oauth.state = [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function genPKCE() {
  // verifier 64 random bytes → base64url; challenge = SHA-256(verifier)
  const arr = new Uint8Array(48)
  crypto.getRandomValues(arr)
  const verifier = btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  oauth.codeChallenge = challenge
  pkceVerifier.value = verifier
}
const pkceVerifier = ref('')

// =============== API Test ===============
const api = reactive({
  method: 'GET',
  url: 'https://graph.microsoft.com/v1.0/me',
  token: '',
  headers: '',
  body: ''
})
const apiResp = ref<{ status: number; statusText: string; headers: Record<string, string>; body: string; ms: number } | null>(null)
const apiLoading = ref(false)
const apiErr = ref('')

async function callApi() {
  apiLoading.value = true
  apiErr.value = ''
  apiResp.value = null
  const start = performance.now()
  try {
    const headers: Record<string, string> = {}
    if (api.token.trim()) headers['Authorization'] = `Bearer ${api.token.trim()}`
    if (api.headers.trim()) {
      for (const line of api.headers.split('\n')) {
        const idx = line.indexOf(':')
        if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
      }
    }
    const init: RequestInit = { method: api.method, headers }
    if (api.method !== 'GET' && api.method !== 'HEAD' && api.body.trim()) init.body = api.body
    const r = await fetch(api.url, init)
    const text = await r.text()
    const respHeaders: Record<string, string> = {}
    r.headers.forEach((v, k) => (respHeaders[k] = v))
    let prettyBody = text
    if (respHeaders['content-type']?.includes('json')) {
      try { prettyBody = JSON.stringify(JSON.parse(text), null, 2) } catch {}
    }
    apiResp.value = {
      status: r.status,
      statusText: r.statusText,
      headers: respHeaders,
      body: prettyBody,
      ms: Math.round(performance.now() - start)
    }
  } catch (e: any) {
    apiErr.value = e.message
  } finally {
    apiLoading.value = false
  }
}

function copy(text: string, title = 'Đã copy') {
  if (!text) return
  navigator.clipboard.writeText(text)
  toast.add({ title, color: 'success', icon: 'i-lucide-copy-check' })
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Tabs -->
    <div class="inline-flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 self-start">
      <button
        v-for="t in [
          { v: 'jwt', l: 'JWT Decode', i: 'i-lucide-key' },
          { v: 'authurl', l: 'Authorize URL', i: 'i-lucide-link' },
          { v: 'apicall', l: 'API Test', i: 'i-lucide-zap' }
        ]"
        :key="t.v"
        type="button"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium rounded-md transition-colors"
        :class="
          tab === t.v
            ? 'bg-white dark:bg-neutral-900 text-primary-700 dark:text-primary-300 shadow-sm'
            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
        "
        @click="tab = t.v as Tab"
      >
        <UIcon :name="t.i" class="w-3.5 h-3.5" />
        {{ t.l }}
      </button>
    </div>

    <!-- JWT -->
    <div v-if="tab === 'jwt'" class="flex flex-col gap-3">
      <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
        <label class="text-[12.5px] font-medium block mb-2">JWT Token</label>
        <textarea
          v-model="jwtToken"
          rows="4"
          spellcheck="false"
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6Ikpva..."
          class="w-full resize-y border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 font-mono text-[12px] leading-relaxed bg-white dark:bg-neutral-950 break-all"
        />
        <div v-if="expInfo" class="mt-3 flex flex-wrap items-center gap-3 text-[12px]">
          <UBadge v-if="expInfo.iat" color="neutral" variant="soft">
            <UIcon name="i-lucide-calendar-plus" class="w-3.5 h-3.5" />
            <span class="ml-1">Issued: {{ expInfo.iat }}</span>
          </UBadge>
          <UBadge v-if="expInfo.exp" :color="expInfo.expired ? 'error' : 'success'" variant="soft">
            <UIcon name="i-lucide-clock" class="w-3.5 h-3.5" />
            <span class="ml-1">{{ expInfo.expired ? 'Hết hạn' : 'Còn hạn' }} · {{ expInfo.remaining }}</span>
          </UBadge>
        </div>
      </section>

      <div class="grid gap-3 grid-cols-1 lg:grid-cols-3">
        <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-red-500">Header</div>
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-copy" square @click="copy(JSON.stringify(jwtHeader, null, 2))" />
          </div>
          <pre class="text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-all min-h-[120px]">{{ jwtHeader ? JSON.stringify(jwtHeader, null, 2) : '—' }}</pre>
        </section>
        <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-violet-500">Payload</div>
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-copy" square @click="copy(JSON.stringify(jwtPayload, null, 2))" />
          </div>
          <pre class="text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-all min-h-[120px]">{{ jwtPayload ? JSON.stringify(jwtPayload, null, 2) : '—' }}</pre>
        </section>
        <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-cyan-500">Signature</div>
          </div>
          <pre class="text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-all min-h-[120px] text-neutral-500">{{ jwtSignature || '—' }}</pre>
        </section>
      </div>
    </div>

    <!-- Auth URL -->
    <div v-if="tab === 'authurl'" class="flex flex-col gap-3">
      <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
        <div class="flex flex-wrap gap-2 mb-4">
          <UButton variant="outline" color="neutral" size="xs" @click="presetMicrosoft">Microsoft</UButton>
          <UButton variant="outline" color="neutral" size="xs" @click="presetGoogle">Google</UButton>
          <UButton variant="outline" color="neutral" size="xs" @click="presetFacebook">Facebook</UButton>
          <div class="flex-1" />
          <UButton variant="outline" color="neutral" size="xs" icon="i-lucide-shuffle" @click="genState">State ngẫu nhiên</UButton>
          <UButton variant="outline" color="neutral" size="xs" icon="i-lucide-shield-check" @click="genPKCE">PKCE</UButton>
        </div>

        <div class="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5 sm:col-span-2">
            <label class="text-[12.5px] font-medium">Authorize endpoint</label>
            <UInput v-model="oauth.authEndpoint" size="sm" :ui="{ base: 'font-mono text-[12px]' }" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[12.5px] font-medium">client_id</label>
            <UInput v-model="oauth.clientId" size="sm" :ui="{ base: 'font-mono text-[12px]' }" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[12.5px] font-medium">redirect_uri</label>
            <UInput v-model="oauth.redirectUri" size="sm" :ui="{ base: 'font-mono text-[12px]' }" />
          </div>
          <div class="flex flex-col gap-1.5 sm:col-span-2">
            <label class="text-[12.5px] font-medium">scope</label>
            <UInput v-model="oauth.scope" size="sm" :ui="{ base: 'font-mono text-[12px]' }" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[12.5px] font-medium">response_type</label>
            <USelect
              v-model="oauth.responseType"
              size="sm"
              :items="[
                { label: 'code (Authorization Code)', value: 'code' },
                { label: 'token (Implicit)', value: 'token' },
                { label: 'id_token', value: 'id_token' },
                { label: 'code id_token', value: 'code id_token' }
              ]"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[12.5px] font-medium">prompt (tùy chọn)</label>
            <UInput v-model="oauth.prompt" size="sm" placeholder="login | consent | none" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[12.5px] font-medium">state</label>
            <UInput v-model="oauth.state" size="sm" :ui="{ base: 'font-mono text-[12px]' }" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[12.5px] font-medium">code_challenge</label>
            <UInput v-model="oauth.codeChallenge" size="sm" :ui="{ base: 'font-mono text-[12px]' }" />
          </div>
        </div>
      </section>

      <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
        <div class="flex items-center justify-between mb-2">
          <div class="text-[12.5px] font-semibold">URL kết quả</div>
          <div class="flex gap-2">
            <UButton variant="outline" color="neutral" size="xs" icon="i-lucide-copy" @click="copy(authorizeUrl, 'Đã copy URL')">Copy URL</UButton>
            <UButton color="primary" size="xs" icon="i-lucide-external-link" :to="authorizeUrl" target="_blank" :disabled="!authorizeUrl">Mở</UButton>
          </div>
        </div>
        <pre class="text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-all bg-neutral-50 dark:bg-neutral-950 p-3 rounded-md border border-neutral-200 dark:border-neutral-800">{{ authorizeUrl || '—' }}</pre>
        <div v-if="pkceVerifier" class="mt-3 text-[11.5px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
          <UIcon name="i-lucide-info" class="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
          PKCE verifier (lưu lại để gọi /token sau): <code class="px-1 rounded bg-neutral-100 dark:bg-neutral-800 font-mono break-all">{{ pkceVerifier }}</code>
        </div>
      </section>
    </div>

    <!-- API Test -->
    <div v-if="tab === 'apicall'" class="flex flex-col gap-3">
      <section class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
        <div class="flex flex-wrap gap-2 mb-3 items-center">
          <USelect
            v-model="api.method"
            size="sm"
            :items="[
              { label: 'GET', value: 'GET' },
              { label: 'POST', value: 'POST' },
              { label: 'PUT', value: 'PUT' },
              { label: 'PATCH', value: 'PATCH' },
              { label: 'DELETE', value: 'DELETE' }
            ]"
            class="w-28"
          />
          <UInput v-model="api.url" size="sm" class="flex-1 min-w-[260px]" :ui="{ base: 'font-mono text-[12px]' }" placeholder="https://api.example.com/endpoint" />
          <UButton color="primary" size="sm" icon="i-lucide-send" :loading="apiLoading" @click="callApi">Gửi</UButton>
        </div>

        <div class="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <label class="text-[12.5px] font-medium">Bearer token (tùy chọn)</label>
            <UInput v-model="api.token" type="password" size="sm" :ui="{ base: 'font-mono text-[12px]' }" placeholder="eyJhbGc..." />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[12.5px] font-medium">Headers thêm (mỗi dòng <code class="font-mono text-[11px]">Key: Value</code>)</label>
            <UInput v-model="api.headers" size="sm" :ui="{ base: 'font-mono text-[12px]' }" placeholder="Accept: application/json" />
          </div>
          <div v-if="['POST','PUT','PATCH'].includes(api.method)" class="flex flex-col gap-1.5 sm:col-span-2">
            <label class="text-[12.5px] font-medium">Request body</label>
            <textarea
              v-model="api.body"
              rows="4"
              spellcheck="false"
              class="w-full resize-y border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 font-mono text-[12px] bg-white dark:bg-neutral-950"
            />
          </div>
        </div>
      </section>

      <UAlert
        v-if="apiErr"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-triangle"
        :title="`Lỗi: ${apiErr}`"
        description="Có thể do CORS — server đích không cho phép gọi từ trình duyệt. Thử Microsoft Graph hoặc API có CORS."
      />

      <section v-if="apiResp" class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div class="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold">
          <UBadge :color="apiResp.status < 400 ? 'success' : 'error'" variant="solid">{{ apiResp.status }} {{ apiResp.statusText }}</UBadge>
          <span class="text-neutral-500 font-mono">{{ apiResp.ms }}ms</span>
          <div class="flex-1" />
          <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-copy" @click="copy(apiResp.body)">Copy body</UButton>
        </div>
        <div class="grid gap-0 grid-cols-1 lg:grid-cols-[260px_1fr]">
          <div class="p-3 border-b lg:border-b-0 lg:border-r border-neutral-200 dark:border-neutral-800">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">Headers</div>
            <dl class="text-[11.5px] font-mono space-y-1">
              <template v-for="(v, k) in apiResp.headers" :key="k">
                <dt class="text-neutral-500 break-all">{{ k }}</dt>
                <dd class="text-neutral-700 dark:text-neutral-300 break-all">{{ v }}</dd>
              </template>
            </dl>
          </div>
          <pre class="p-3 text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-all overflow-auto max-h-[500px]">{{ apiResp.body }}</pre>
        </div>
      </section>
    </div>
  </div>
</template>
