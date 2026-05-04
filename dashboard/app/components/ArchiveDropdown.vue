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

const eventArchives = $computed(() =>
  archives.filter((archive) => archive.trigger_type === 'manual'),
)
const dailyArchives = $computed(() =>
  archives.filter((archive) => archive.trigger_type === 'scheduled'),
)

function formatLabel(archive: Archive): string {
  const date = new Date(archive.date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  if (archive.trigger_type === 'manual') {
    return archive.name ? `${date}, ${archive.name}` : date
  }
  return date
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
  <div v-if="archives.length === 0">
    <span class="text-gray-400 text-xs">No archives available.</span>
  </div>
  <div v-else class="space-y-3">
    <div v-if="eventArchives.length > 0">
      <span class="block font-semibold mb-1 text-xs">Event Archives</span>
      <u-select-menu
        class="w-full"
        :items="
          eventArchives.map((archive) => ({
            label: formatLabel(archive),
            value: archiveKey(archive),
          }))
        "
        :model-value="store.archiveKey || undefined"
        placeholder="Select event archive…"
        value-key="value"
        @update:model-value="selectArchive($event)"
      />
    </div>
    <div v-if="dailyArchives.length > 0">
      <span class="block font-semibold mb-1 text-xs">Daily Archives</span>
      <u-select-menu
        class="w-full"
        :items="
          dailyArchives.map((archive) => ({
            label: formatLabel(archive),
            value: archiveKey(archive),
          }))
        "
        :model-value="store.archiveKey || undefined"
        placeholder="Select daily archive…"
        value-key="value"
        @update:model-value="selectArchive($event)"
      />
    </div>
    <u-button
      v-if="store.archiveKey"
      class="text-xs w-full"
      size="xs"
      variant="ghost"
      @click="selectArchive(null)"
    >
      Back To Live
    </u-button>
  </div>
</template>
