// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['micro-fe-sdk/nuxt'],
  runtimeConfig: {
    public: {
      microAppsBase: 'http://localhost:8080',
      apiBase: 'http://localhost:3001',
    },
  },
})
