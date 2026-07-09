// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  ssr: true,
  app: {
    head: {
      htmlAttrs: { lang: 'vi' },
      title: 'TextKit — Tiện ích chỉnh sửa text online',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'TextKit — Bộ tiện ích chỉnh sửa text online: cắt chuỗi, lọc dòng, ghép file, JSON, Base64, Diff, Word Counter, trích link... Toàn bộ xử lý chạy trên trình duyệt.'
        },
        { name: 'theme-color', content: '#16a34a' }
      ],
      link: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href:
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2316a34a'/%3E%3Ctext x='50%25' y='58%25' text-anchor='middle' font-family='Inter,Arial' font-size='16' font-weight='700' fill='white'%3ETk%3C/text%3E%3C/svg%3E"
        },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
        }
      ]
    }
  },
  ui: {
    colorMode: true
  },
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light'
  },
  typescript: { strict: false }
})
