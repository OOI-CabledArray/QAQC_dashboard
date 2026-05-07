export default defineNuxtRouteMiddleware((to, from) => {
  const archive = from.query.archive
  if (archive && !to.query.archive) {
    return navigateTo({ ...to, query: { ...to.query, archive } }, { replace: true })
  }
})
