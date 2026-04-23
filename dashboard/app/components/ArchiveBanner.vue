<script lang="ts" setup>
import { useStore } from '~/store'

const store = useStore()
const router = useRouter()
const route = useRoute()

let archiveName = $ref<string | null>(null)

async function loadArchiveName() {
  if (!store.archiveKey) {
    archiveName = null
    return
  }

  try {
    const archives = await $fetch<any[]>('/api/archives')
    const key = store.archiveKey
    const match = archives.find((a) => `${a.date}-${a.slug}` === key)
    if (match?.name) {
      archiveName = match.name
    } else if (match) {
      archiveName = null
    }
  } catch {
    archiveName = null
  }
}

async function backToLive() {
  await store.exitArchiveMode()
  const { archive: _, ...rest } = route.query
  await router.replace({ query: rest })
}

watch(() => store.archiveKey, loadArchiveName, { immediate: true })

const dateLabel = $computed(() => {
  if (!store.archiveKey) {
    return ''
  }
  const datePart = store.archiveKey.slice(0, 10)
  return new Date(datePart + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
})
</script>

<template>
  <div
    v-if="store.archiveKey"
    class="flex items-center justify-between bg-amber-100 border-b border-amber-300 px-4 py-2 text-amber-900"
  >
    <span class="text-sm font-medium">
      Viewing archive: {{ dateLabel }}<template v-if="archiveName"> — {{ archiveName }}</template>
    </span>
    <u-button size="xs" variant="soft" color="amber" @click="backToLive">Back to live</u-button>
  </div>
</template>
