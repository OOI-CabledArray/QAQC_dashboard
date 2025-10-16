import { resolve } from 'path'

import Tailwind from '@tailwindcss/vite'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import VueMacros from 'vue-macros/vite'

// https://vite.dev/config
export default defineConfig({
  plugins: [
    VueMacros({
      plugins: {
        vue: Vue(),
      },
    }),
    Tailwind(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'), // Allow importing from 'src' using '@' alias.
    },
  },
  publicDir: resolve(__dirname, './public'),
  server: {
    port: 8085,
  },
})
