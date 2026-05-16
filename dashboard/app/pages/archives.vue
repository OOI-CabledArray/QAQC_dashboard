<script lang="ts" setup>
import { upperFirst } from 'lodash-es'

import { useAuth } from '~/auth'
import { usePersisted } from '~/persisted'
import { useStore } from '~/store'

type Archive = {
  id: string
  date: string
  slug: string
  prefix: string
  name: string | null
  type: 'scheduled' | 'event' | 'internal'
  status: 'pending' | 'complete'
  created_at: string
}

const auth = useAuth()
const store = useStore()
const toast = useToast()

let archives = $ref<Archive[]>([])
let loading = $ref(true)
let deletingArchive = $ref<Archive | null>(null)
let submitting = $ref(false)

const persisted = usePersisted({
  schema: ({ object, enum: choice }) =>
    object({
      type: choice(['scheduled', 'event', 'internal']).default('scheduled'),
    }),
  methods: [{ type: 'url' }],
})

const archiveTypeFilter = $computed({
  get: () => persisted.type,
  set: (value) => {
    persisted.type = value
  },
})
let showCreateInternalDialog = $ref(false)
let internalArchiveName = $ref('')
let creatingInternal = $ref(false)
let showCreateEventDialog = $ref(false)
let eventArchiveName = $ref('')
let creatingEvent = $ref(false)

const archiveTypeOptions = $computed(() => {
  const options: { label: string; value: 'scheduled' | 'event' | 'internal' }[] = [
    { label: 'By Date', value: 'scheduled' },
    { label: 'Event', value: 'event' },
  ]
  if (auth.loggedIn) {
    options.push({ label: 'Internal', value: 'internal' })
  }
  return options
})

const filteredArchives = $computed(() =>
  archives
    .filter((archive) => {
      if (archiveTypeFilter === 'internal') {
        return archive.type === 'internal'
      }
      return archive.type === archiveTypeFilter
    })
    .filter((archive) => auth.loggedIn || archive.status === 'complete'),
)

async function loadArchives() {
  try {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    archives = await $fetch('/api/archives', { headers })
  } catch {
    archives = []
    if (import.meta.client) {
      toast.add({ title: 'Failed to load archives.', color: 'error' })
    }
  } finally {
    loading = false
  }
}

async function deleteArchive() {
  if (!deletingArchive) {
    return
  }
  submitting = true
  try {
    await $fetch(`/api/archives/${deletingArchive.id}`, { method: 'DELETE' })
    toast.add({ title: 'Archive deleted.', color: 'success' })
    deletingArchive = null
    await loadArchives()
  } catch (error: any) {
    toast.add({
      title: error.data?.statusMessage || 'Failed to delete archive.',
      color: 'error',
    })
  } finally {
    submitting = false
  }
}

function viewArchive(archive: Archive) {
  let key: string
  if (archive.type === 'scheduled') {
    key = `scheduled/${archive.date}`
  } else if (archive.type === 'internal') {
    key = `internal/${archive.slug}`
  } else {
    key = `event/${archive.date}-${archive.slug}`
  }
  store.enterArchiveMode(key)
}

async function createEventArchive() {
  creatingEvent = true
  try {
    await $fetch('/api/archives', {
      method: 'POST',
      body: { name: eventArchiveName },
    })
    toast.add({ title: `Creating event archive "${eventArchiveName}".`, color: 'success' })
    showCreateEventDialog = false
    eventArchiveName = ''
    await loadArchives()
  } catch (error: any) {
    toast.add({
      title: error.data?.statusMessage || 'Failed to create event archive.',
      color: 'error',
    })
  } finally {
    creatingEvent = false
  }
}

async function createInternalArchive() {
  creatingInternal = true
  try {
    await $fetch('/api/archives/internal', {
      method: 'POST',
      body: { name: internalArchiveName },
    })
    toast.add({ title: `Creating internal archive "${internalArchiveName}".`, color: 'success' })
    showCreateInternalDialog = false
    internalArchiveName = ''
    await loadArchives()
  } catch (error: any) {
    toast.add({
      title: error.data?.statusMessage || 'Failed to create internal archive.',
      color: 'error',
    })
  } finally {
    creatingInternal = false
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTimestamp(isoString: string): string {
  return new Date(isoString + 'Z').toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatLabel(archive: Archive): string {
  if (archive.name) {
    return archive.name
  }
  return formatDate(archive.date)
}

await Promise.all([loadArchives(), callOnce(auth.fetch)])
</script>

<template>
  <div class="max-w-4xl mx-auto p-3 sm:p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="font-bold text-2xl">Archives</h1>
      <div class="flex gap-3 items-center">
        <u-button
          v-if="auth.loggedIn && archiveTypeFilter === 'event'"
          size="sm"
          @click="showCreateEventDialog = true"
        >
          <i class="fa-plus fas mr-1" />
          Create Event Archive
        </u-button>
        <u-button
          v-if="auth.isAdmin && archiveTypeFilter === 'internal'"
          size="sm"
          @click="showCreateInternalDialog = true"
        >
          <i class="fa-plus fas mr-1" />
          Create Internal Archive
        </u-button>
        <div class="flex overflow-hidden rounded text-sm">
          <button
            v-for="option in archiveTypeOptions"
            :key="option.value"
            :class="[
              'px-3 py-1 transition-colors',
              archiveTypeFilter === option.value
                ? 'bg-primary-500 font-medium text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-600',
            ]"
            @click="archiveTypeFilter = option.value as typeof archiveTypeFilter"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="py-12 text-center text-gray-500">Loading...</div>

    <div v-else-if="filteredArchives.length === 0" class="py-12 text-center text-gray-500">
      No
      {{ { scheduled: 'date', event: 'event', internal: 'internal' }[archiveTypeFilter as string] }}
      archives yet.
    </div>

    <!-- Mobile -->
    <div v-else class="sm:hidden space-y-3">
      <div
        v-for="archive in filteredArchives"
        :key="archive.id"
        :class="[
          'border p-3 rounded-lg',
          archive.status === 'complete' ? 'cursor-pointer hover:bg-gray-50' : '',
        ]"
        @click="archive.status === 'complete' && viewArchive(archive)"
      >
        <div class="flex items-center justify-between mb-1">
          <span class="font-medium text-sm">{{ formatLabel(archive) }}</span>
          <u-badge
            v-if="auth.loggedIn"
            :color="archive.status === 'complete' ? 'success' : 'warning'"
            variant="subtle"
          >
            {{ upperFirst(archive.status) }}
          </u-badge>
        </div>
        <div class="flex items-center justify-between">
          <div v-if="archive.type !== 'internal'" class="text-gray-500 text-xs">
            {{
              archive.type === 'event'
                ? formatTimestamp(archive.created_at)
                : formatDate(archive.date)
            }}
          </div>
          <div v-else />
          <div v-if="auth.loggedIn" class="flex gap-1">
            <u-tooltip text="Delete">
              <u-button
                class="hover:text-[var(--ui-error)] text-gray-500"
                size="xs"
                variant="ghost"
                @click.stop="deletingArchive = archive"
              >
                <i class="fa-trash fas" />
              </u-button>
            </u-tooltip>
          </div>
        </div>
      </div>
    </div>

    <!-- Desktop -->
    <div
      v-if="!loading && filteredArchives.length > 0"
      class="max-sm:hidden min-w-0 overflow-x-auto"
    >
      <u-table
        :columns="[
          { accessorKey: 'name', header: 'Name' },
          ...(archiveTypeFilter !== 'internal' ? [{ accessorKey: 'date', header: 'Date' }] : []),
          ...(auth.loggedIn
            ? [
                { accessorKey: 'status', header: 'Status' },
                { accessorKey: 'actions', header: '' },
              ]
            : []),
        ]"
        :data="filteredArchives"
        @select="
          (_event: Event, row: any) =>
            row.original.status === 'complete' && viewArchive(row.original)
        "
      >
        <template #name-cell="{ row }">
          {{ formatLabel(row.original) }}
        </template>
        <template #date-cell="{ row }">
          {{
            row.original.type === 'event'
              ? formatTimestamp(row.original.created_at)
              : formatDate(row.original.date)
          }}
        </template>
        <template #status-cell="{ row }">
          <u-badge
            :color="row.original.status === 'complete' ? 'success' : 'warning'"
            variant="subtle"
          >
            {{ upperFirst(row.original.status) }}
          </u-badge>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end">
            <u-tooltip text="Delete">
              <u-button
                class="hover:text-[var(--ui-error)] text-gray-500"
                size="xs"
                variant="ghost"
                @click.stop="deletingArchive = row.original"
              >
                <i class="fa-trash fas" />
              </u-button>
            </u-tooltip>
          </div>
        </template>
      </u-table>
    </div>

    <!-- Create Event Archive Dialog -->
    <u-modal v-model:open="showCreateEventDialog">
      <template #header>
        <span class="font-semibold">Create Event Archive</span>
      </template>
      <template #body>
        <form class="space-y-4" @submit.prevent="createEventArchive">
          <u-form-field label="Event Name">
            <u-input v-model="eventArchiveName" class="w-full" required />
          </u-form-field>
          <div class="flex gap-2 justify-end">
            <u-button variant="ghost" @click="showCreateEventDialog = false">Cancel</u-button>
            <u-button :loading="creatingEvent" type="submit">Create</u-button>
          </div>
        </form>
      </template>
    </u-modal>

    <!-- Create Internal Archive Dialog -->
    <u-modal v-model:open="showCreateInternalDialog">
      <template #header>
        <span class="font-semibold">Create Internal Archive</span>
      </template>
      <template #body>
        <form class="space-y-4" @submit.prevent="createInternalArchive">
          <u-form-field label="Name">
            <u-input v-model="internalArchiveName" class="w-full" required />
          </u-form-field>
          <div class="flex gap-2 justify-end">
            <u-button variant="ghost" @click="showCreateInternalDialog = false">Cancel</u-button>
            <u-button :loading="creatingInternal" type="submit">Create</u-button>
          </div>
        </form>
      </template>
    </u-modal>

    <!-- Delete Confirmation Dialog -->
    <u-modal :open="!!deletingArchive" @update:open="deletingArchive = null">
      <template #header>
        <span class="font-semibold">Delete Archive</span>
      </template>
      <template #body>
        <p class="mb-4 text-sm">
          Are you sure you want to delete the archive
          <strong>{{ deletingArchive ? formatLabel(deletingArchive) : '' }}</strong
          >? This will remove all archived files and cannot be undone.
        </p>
        <div class="flex gap-2 justify-end">
          <u-button variant="ghost" @click="deletingArchive = null">Cancel</u-button>
          <u-button color="red" :loading="submitting" @click="deleteArchive">Delete</u-button>
        </div>
      </template>
    </u-modal>
  </div>
</template>
