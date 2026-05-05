<script lang="ts" setup>
import { useStore } from '~/store'

const { open } = defineProps<{ open: boolean }>()

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
  status: string
  image_count: number
  created_at: string
}

let archives = $ref<Archive[]>([])
let pollTimer = $ref<ReturnType<typeof setInterval> | null>(null)
const cancellingIds = $ref(new Set<string>())
const archiveTypeFilter = $ref<'all' | 'manual' | 'scheduled'>('all')

const archiveTypeOptions = [
  { label: 'Any Type', value: 'all' },
  { label: 'Event', value: 'manual' },
  { label: 'Scheduled', value: 'scheduled' },
]

const completeArchives = $computed(() => {
  const complete = archives.filter((archive) => archive.status === 'complete')
  if (archiveTypeFilter === 'all') {
    return complete
  }
  return complete.filter((archive) => archive.trigger_type === archiveTypeFilter)
})

const pendingArchives = $computed(() => archives.filter((archive) => archive.status === 'pending'))

function formatLabel(archive: Archive): string {
  const date = new Date(archive.date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  if (archive.trigger_type === 'manual' && archive.name) {
    return `${date}, ${archive.name}`
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

function startPolling() {
  if (!pollTimer) {
    pollTimer = setInterval(loadArchives, 5000)
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

watch(
  () => open,
  (isOpen) => {
    if (isOpen) {
      loadArchives()
      startPolling()
    } else {
      stopPolling()
    }
  },
  { immediate: true },
)

async function cancelArchive(id: string) {
  cancellingIds.add(id)
  try {
    await $fetch(`/api/archives/${id}`, { method: 'DELETE' })
    await loadArchives()
  } catch (error) {
    console.error('Failed to cancel archive:', error)
  } finally {
    cancellingIds.delete(id)
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

onUnmounted(() => {
  stopPolling()
})

defineExpose({ refresh: loadArchives })
</script>

<template>
  <div class="space-y-3">
    <div v-if="pendingArchives.length > 0">
      <div
        v-for="archive in pendingArchives"
        :key="archive.id"
        class="flex gap-2 items-center py-1"
      >
        <div class="flex items-center justify-between w-full">
          <u-tooltip text="This archive is being created and will be available shortly.">
            <div class="flex gap-2 items-center text-gray-400 text-xs">
              <i class="fa-spin fa-spinner fas" />
              <span>{{ formatLabel(archive) }}</span>
            </div>
          </u-tooltip>
          <u-button
            color="red"
            :loading="cancellingIds.has(archive.id)"
            size="xs"
            variant="ghost"
            @click="cancelArchive(archive.id)"
          >
            Cancel
          </u-button>
        </div>
      </div>
    </div>
    <div>
      <span class="block font-semibold mb-1 text-xs">View Archive</span>
      <u-select-menu
        v-model="archiveTypeFilter"
        class="w-full"
        :items="archiveTypeOptions"
        size="xs"
        value-key="value"
      />
    </div>
    <div>
      <u-select-menu
        class="w-full"
        :items="
          completeArchives.map((archive) => ({
            label: formatLabel(archive),
            value: archiveKey(archive),
          }))
        "
        :model-value="store.archiveKey || undefined"
        placeholder="Select"
        size="xs"
        value-key="value"
        @update:model-value="selectArchive($event)"
      >
        <template #empty>No archives available.</template>
      </u-select-menu>
    </div>
    <div v-if="store.archiveKey" class="flex justify-center">
      <u-button class="text-xs" size="xs" variant="ghost" @click="selectArchive(null)">
        Back To Live
      </u-button>
    </div>
  </div>
</template>
