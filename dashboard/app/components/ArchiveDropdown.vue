<script lang="ts" setup>
import { useStore } from '~/store'

const store = useStore()
const route = useRoute()
const router = useRouter()

type Archive = {
  id: string
  date: string
  slug: string
  prefix: string
  name: string | null
  trigger_type: string
  image_count: number
  created_at: string
}

let archives = $ref<Archive[]>([])

function formatLabel(archive: Archive): string {
  const date = new Date(archive.date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  if (archive.name) {
    return `${date} — ${archive.name}`
  }
  return `${date} (daily)`
}

function archiveKey(archive: Archive): string {
  return `${archive.date}-${archive.slug}`
}

async function loadArchives() {
  try {
    archives = await $fetch('/api/archives')
  } catch {
    archives = []
  }
}

async function selectArchive(key: string | null) {
  if (key) {
    await store.enterArchiveMode(key)
    await router.replace({ query: { ...route.query, archive: key } })
  } else {
    await store.exitArchiveMode()
    const { archive: _, ...rest } = route.query
    await router.replace({ query: rest })
  }
}

if (import.meta.client) {
  loadArchives()

  const archiveParam = route.query.archive as string | undefined
  if (archiveParam) {
    store.enterArchiveMode(archiveParam)
  }
}
</script>

<template>
  <div v-if="archives.length > 0">
    <u-select-menu
      :model-value="store.archiveKey || undefined"
      :items="archives.map((a) => ({ label: formatLabel(a), value: archiveKey(a) }))"
      placeholder="View archive…"
      value-key="value"
      class="w-full"
      @update:model-value="selectArchive($event)"
    />
    <u-button
      v-if="store.archiveKey"
      class="mt-1 w-full text-xs"
      size="xs"
      variant="ghost"
      @click="selectArchive(null)"
    >
      Back to live
    </u-button>
  </div>
</template>
