export default defineNuxtRouteMiddleware(async (to) => {
  try {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    await $fetch('/api/me', { headers })
  } catch {
    if (import.meta.client) {
      const toast = useToast()
      toast.add({ title: 'Log in to view that resource.', color: 'warning' })
    }
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
