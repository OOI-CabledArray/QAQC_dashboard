import { defineStore } from 'pinia'
import { computed } from 'vue'

type User = {
  id: string
  username: string
  email: string | null
  name: string
  role: 'admin' | 'viewer'
}

export const useAuth = defineStore('auth', () => {
  let user = $ref<User | null>(null)

  async function fetch() {
    try {
      const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
      user = await $fetch('/api/me', { headers })
    } catch {
      user = null
    }
  }

  async function logout() {
    try {
      await $fetch('/api/logout', { method: 'POST' })
    } catch {
      // Ignore errors
    }
    user = null
    await navigateTo('/login')
  }

  return {
    user: $$(user),
    loggedIn: computed(() => !!user),
    isAdmin: computed(() => user?.role === 'admin'),
    fetch,
    logout,
  }
})
