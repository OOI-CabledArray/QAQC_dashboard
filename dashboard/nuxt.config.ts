import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2025-10-29',
  modules: ['@nuxt/ui', '@vue-macros/nuxt', '@nuxt/eslint', '@pinia/nuxt'],
  vue: {
    // Allow safe destructured assignment of component props.
    propsDestructure: true,
  },
  ssr: false,
  // Load main, custom CSS module.
  css: ['@/assets/css/main.css'],
  // Force light mode.
  colorMode: {
    preference: 'light',
    fallback: 'light',
  },
  // Don't prefix global component names with their path.
  components: [
    {
      path: '@/components',
      pathPrefix: false,
    },
  ],
})
