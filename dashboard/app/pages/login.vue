<script lang="ts" setup>
definePageMeta({
  layout: false,
})

let email = $ref('')
let password = $ref('')
let error = $ref('')
let loading = $ref(false)

const router = useRouter()

async function login() {
  error = ''
  loading = true

  try {
    await $fetch('/api/login', {
      method: 'POST',
      body: { email, password },
    })
    await router.push('/')
  } catch (fetchError: any) {
    error = fetchError.data?.statusMessage || 'Login failed'
  } finally {
    loading = false
  }
}
</script>

<template>
  <div class="flex h-screen items-center justify-center bg-gray-50">
    <div class="w-full max-w-sm rounded-lg bg-white p-8 shadow">
      <h1 class="mb-6 text-center text-2xl font-bold">QAQC Dashboard</h1>

      <form @submit.prevent="login">
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-gray-700" for="email">Email</label>
          <u-input id="email" v-model="email" type="email" placeholder="Email" required />
        </div>

        <div class="mb-6">
          <label class="mb-1 block text-sm font-medium text-gray-700" for="password">
            Password
          </label>
          <u-input
            id="password"
            v-model="password"
            type="password"
            placeholder="Password"
            required
          />
        </div>

        <div v-if="error" class="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">
          {{ error }}
        </div>

        <u-button block type="submit" :loading="loading">Log in</u-button>
      </form>
    </div>
  </div>
</template>
