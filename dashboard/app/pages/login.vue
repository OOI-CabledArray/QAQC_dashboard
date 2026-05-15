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
        <u-form-field class="mb-4" label="Username">
          <u-input v-model="username" autofocus class="w-full" placeholder="Username" required />
        </u-form-field>

        <u-form-field class="mb-6" label="Password">
          <u-input
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
        </u-form-field>

        <div v-if="error" class="bg-red-50 mb-4 p-3 rounded text-red-600 text-sm">
          {{ error }}
        </div>

        <u-button block :loading="loading" type="submit">Log In</u-button>
      </form>
    </div>
  </div>
</template>
