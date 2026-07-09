// Feedback / báo lỗi endpoint.
// Lưu mỗi entry vào /data/feedbacks.jsonl (1 dòng JSON / record), append-only.
// Có rate limit đơn giản theo IP để chống spam (in-memory).

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

type Body = {
  type?: 'bug' | 'suggestion' | 'question'
  tool?: string
  title?: string
  description?: string
  email?: string
}

// IP → array of timestamps (ms) trong cửa sổ 1 phút. Tối đa 5 request/phút/IP.
const recentByIp = new Map<string, number[]>()
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)

  // Validate
  const errors: string[] = []
  const type = body?.type
  if (!type || !['bug', 'suggestion', 'question'].includes(type)) errors.push('type không hợp lệ')
  const title = (body?.title || '').trim()
  if (title.length < 5 || title.length > 200) errors.push('title phải 5-200 ký tự')
  const description = (body?.description || '').trim()
  if (description.length < 10 || description.length > 5000) errors.push('description phải 10-5000 ký tự')
  const email = (body?.email || '').trim()
  if (email && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) errors.push('email không hợp lệ')

  if (errors.length) {
    throw createError({ statusCode: 400, statusMessage: errors.join('; ') })
  }

  // Rate limit theo IP
  const ip =
    getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
    getRequestHeader(event, 'x-real-ip') ||
    event.node.req.socket.remoteAddress ||
    'unknown'
  const now = Date.now()
  const arr = (recentByIp.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  if (arr.length >= MAX_PER_WINDOW) {
    throw createError({ statusCode: 429, statusMessage: 'Quá nhiều request, thử lại sau 1 phút' })
  }
  arr.push(now)
  recentByIp.set(ip, arr)
  // Cleanup map nếu quá 1000 IP (tránh memory leak)
  if (recentByIp.size > 1000) {
    const firstKey = recentByIp.keys().next().value
    if (firstKey) recentByIp.delete(firstKey)
  }

  // Build entry
  const entry = {
    id: randomUUID(),
    type,
    tool: body.tool ? String(body.tool).slice(0, 60) : null,
    title,
    description,
    email: email || null,
    userAgent: getRequestHeader(event, 'user-agent') || null,
    referer: getRequestHeader(event, 'referer') || null,
    ip: ip.replace(/^::ffff:/, ''),
    timestamp: new Date().toISOString()
  }

  // Append vào /data/feedbacks.jsonl
  const dataDir = join(process.cwd(), 'data')
  await fs.mkdir(dataDir, { recursive: true })
  const file = join(dataDir, 'feedbacks.jsonl')
  await fs.appendFile(file, JSON.stringify(entry) + '\n', 'utf-8')

  // Optional: gửi Discord webhook nếu có cấu hình env var
  const webhook = process.env.FEEDBACK_DISCORD_WEBHOOK
  if (webhook) {
    const emoji = type === 'bug' ? '🐛' : type === 'suggestion' ? '💡' : '❓'
    const content = `${emoji} **${title}**\n${entry.tool ? `\`${entry.tool}\` · ` : ''}${entry.email || 'no email'}\n\n${description.slice(0, 1500)}`
    fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    }).catch(() => {}) // ignore webhook errors
  }

  return { ok: true, id: entry.id }
})
