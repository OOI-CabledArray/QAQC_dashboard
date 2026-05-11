<script lang="ts" setup>
import { useStore } from '~/store'

const { open } = defineProps<{ open: boolean }>()

const store = useStore()

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
const archiveTypeFilter = $ref<'manual' | 'scheduled'>('scheduled')
const selectedByType = $ref<Record<string, string | undefined>>({})

const archiveTypeOptions = [
  { label: 'By Date', value: 'scheduled', placeholder: 'Date' },
  { label: 'Event', value: 'manual', placeholder: 'Event' },
]

const activePlaceholder = $computed(
  () => archiveTypeOptions.find((option) => option.value === archiveTypeFilter)!.placeholder,
)

const completeArchives = $computed(() => {
  return archives
    .filter((archive) => archive.status === 'complete')
    .filter((archive) => archive.trigger_type === archiveTypeFilter)
})

const pendingArchives = $computed(() => archives.filter((archive) => archive.status === 'pending'))

const selectedArchive = $computed(() => {
  const current = store.currentArchive
  if (current && completeArchives.some((archive) => archiveKey(archive) === current)) {
    return current
  }
  return selectedByType[archiveTypeFilter]
})

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
    selectedByType[archiveTypeFilter] = key
    await store.enterArchiveMode(key)
  } else {
    selectedByType[archiveTypeFilter] = undefined
    await store.exitArchiveMode()
  }
}

if (import.meta.client) {
  loadArchives()
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
    <div class="flex items-center justify-between">
      <span class="font-semibold text-xs">Archives</span>
      <NuxtLink class="hover:underline text-primary-500 text-xs" to="/archives">
        View All <i class="fa-arrow-right fas text-[10px]" />
      </NuxtLink>
    </div>
    <div class="flex overflow-hidden rounded text-[11px]">
      <button
        v-for="option in archiveTypeOptions"
        :key="option.value"
        :class="[
          'flex-1 px-2 py-0.5 transition-colors',
          archiveTypeFilter === option.value
            ? 'bg-primary-500 font-medium text-white'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-600',
        ]"
        @click="archiveTypeFilter = option.value as typeof archiveTypeFilter"
      >
        {{ option.label }}
      </button>
    </div>
    <u-select-menu
      class="w-full"
      :items="
        completeArchives.map((archive) => ({
          label: formatLabel(archive),
          value: archiveKey(archive),
        }))
      "
      :model-value="selectedArchive"
      :placeholder="activePlaceholder"
      size="xs"
      value-key="value"
      @update:model-value="selectArchive($event)"
    >
      <template #empty>No archives available.</template>
    </u-select-menu>
    <div v-if="store.currentArchive" class="flex justify-center">
      <u-button class="text-xs" size="xs" variant="ghost" @click="selectArchive(null)">
        Back To Live
      </u-button>
    </div>
  </div>
</template>
