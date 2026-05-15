<script lang="ts" setup>
definePageMeta({
  layout: false,
})

let username = $ref('')
let password = $ref('')
let error = $ref('')
let loading = $ref(false)
let showPassword = $ref(false)

const route = useRoute()
const router = useRouter()
const toast = useToast()

async function login() {
  error = ''
  loading = true

  try {
    const user = await $fetch('/api/login', {
      method: 'POST',
      body: { username, password },
    })
    toast.add({ title: `Logged in as ${user.name}.`, color: 'success' })
    const redirect = (route.query.redirect as string) || '/'
    await router.push(redirect)
  } catch (fetchError: any) {
    error = fetchError.data?.statusMessage || 'Login failed'
  } finally {
    loading = false
  }
}
</script>

<template>
  <div class="bg-gray-50 flex h-screen items-center justify-center">
    <div class="bg-white max-w-sm p-8 rounded-lg shadow w-full">
      <h1 class="font-bold mb-6 text-2xl text-center">QAQC Dashboard</h1>

      <form @submit.prevent="login">
        <div class="mb-4">
          <label class="block font-medium mb-1 text-gray-700 text-sm" for="username">
            Username
          </label>
          <u-input
            id="username"
            v-model="username"
            autofocus
            class="w-full"
            placeholder="Username"
            required
          />
        </div>

        <div class="mb-6">
          <label class="block font-medium mb-1 text-gray-700 text-sm" for="password">
            Password
          </label>
          <u-input
            id="password"
            v-model="password"
            class="w-full"
            placeholder="Password"
            required
            :type="showPassword ? 'text' : 'password'"
          >
            <template #trailing>
              <button tabindex="-1" type="button" @click="showPassword = !showPassword">
                <i :class="['fas text-gray-400', showPassword ? 'fa-eye-slash' : 'fa-eye']" />
              </button>
            </template>
          </u-input>
        </div>

        <div v-if="error" class="bg-red-50 mb-4 p-3 rounded text-red-600 text-sm">
          {{ error }}
        </div>

        <u-button block :loading="loading" type="submit">Log In</u-button>
      </form>
    </div>
  </div>
</template>
