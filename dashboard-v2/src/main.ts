import '@/style.css'

import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { createApp } from 'vue'

import App from '@/App.vue'
import router from '@/router'
import theme from '@/theme'

createApp(App)
  .use(router)
  .use(createPinia())
  .use(PrimeVue, {
    theme: {
      preset: theme,
      options: {
        darkModeSelector: false,
        cssLayer: {
          name: 'primevue',
          order: 'theme, base, primevue',
        },
      },
    },
  })
  .mount('#app')
