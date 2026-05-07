import { useStore } from '~/store'

export default defineNuxtRouteMiddleware((to, from) => {
  const store = useStore()
  const archive = from.query.archive
  if (archive && !to.query.archive && store.currentArchive) {
    return navigateTo({ ...to, query: { ...to.query, archive } }, { replace: true })
  }
})
