import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2025-10-29',
  modules: ['@nuxt/ui', '@vue-macros/nuxt', '@nuxt/eslint', '@pinia/nuxt'],
  // routeRules: {
  //   '/': { ssr: false },
  //   '/**': { ssr: false },
  // },
  // ssr: false,
  // vue: {
  //   propsDestructure: true,
  // },
  css: ['@/assets/css/main.css'],
  typescript: {
    typeCheck: true,
  },
  colorMode: {
    preference: 'light',
    fallback: 'light',
  },
  // components: [
  //   {
  //     path: '@/components',
  //     pathPrefix: false,
  //   },
  // ],
})
