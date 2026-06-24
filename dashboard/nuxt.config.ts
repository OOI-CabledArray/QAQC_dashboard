import tailwindcss from '@tailwindcss/vite'
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2026-02-19',
  modules: ['@vue-macros/nuxt', '@nuxt/eslint', '@pinia/nuxt', '@nuxt/ui'],
  vite: {
    plugins: [tailwindcss() as any],
  },
  vue: {
    // Allow safe destructured assignment of component props.
    propsDestructure: true,
  },
  ssr: true,
  nitro: {
    imports: {
      dirs: ['server/database'],
    },
    externals: {
      external: ['better-sqlite3', 'kysely'],
    },
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      '0 3 * * 0': ['archive-cleanup'],
      '0 4 * * *': ['database-backup'],
      '0 * * * *': ['expire-sessions'],
    },
  },
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
