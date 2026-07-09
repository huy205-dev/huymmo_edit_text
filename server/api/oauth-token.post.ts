// Server-side proxy cho Microsoft OAuth2 token endpoint.
// Browser bị Microsoft chặn CORS khi client_id không phải SPA-registered (AADSTS90023).
// Proxy này cho phép tool gọi từ trình duyệt mà không cần SPA registration.
//
// Privacy: route chỉ forward request tới Microsoft, KHÔNG log/lưu refresh_token,
// access_token, password hay client_id ở phía server.

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    client_id?: string
    refresh_token?: string
    scope?: string
    tenant?: string
  }>(event)

  if (!body?.client_id || !body?.refresh_token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing client_id or refresh_token'
    })
  }

  const tenant = body.tenant || 'common'
  const form = new URLSearchParams({
    client_id: body.client_id,
    refresh_token: body.refresh_token,
    grant_type: 'refresh_token',
    scope: body.scope || 'https://graph.microsoft.com/Mail.Read offline_access'
  })

  const r = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: form.toString()
    }
  )

  const data = await r.json().catch(() => ({}))
  if (!r.ok) setResponseStatus(event, r.status)
  return data
})
