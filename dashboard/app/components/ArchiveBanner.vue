<script lang="ts" setup>
import { useStore } from '~/store'

const store = useStore()

let archiveName = $ref<string | null>(null)

function parseArchiveKey(key: string): { type: string; date: string; slug: string } {
  const slash = key.indexOf('/')
  const type = key.slice(0, slash)
  const rest = key.slice(slash + 1)
  if (type === 'scheduled') {
    return { type, date: rest, slug: '' }
  }
  if (type === 'internal') {
    return { type, date: '', slug: rest }
  }
  return { type, date: rest.slice(0, 10), slug: rest.slice(11) }
}

async function loadArchiveName() {
  if (!store.currentArchive) {
    archiveName = null
    return
  }

  const parsed = parseArchiveKey(store.currentArchive)

  try {
    const archives = await $fetch<any[]>('/api/archives')
    const match = archives.find(
      (archive) =>
        archive.type === parsed.type &&
        archive.date === parsed.date &&
        archive.slug === parsed.slug,
    )
    archiveName = match?.name || null
  } catch {
    archiveName = null
  }
}

async function backToLive() {
  await store.exitArchiveMode()
}

watch(() => store.currentArchive, loadArchiveName, { immediate: true })

const dateLabel = $computed(() => {
  if (!store.currentArchive) {
    return ''
  }
  const parsed = parseArchiveKey(store.currentArchive)
  if (parsed.type === 'internal') {
    return ''
  }
  return new Date(parsed.date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
})
</script>

<template>
  <div
    v-if="store.currentArchive"
    :class="[
      'bg-amber-100 border-amber-300 border-b flex items-center',
      'justify-between px-4 py-2 text-amber-900',
    ]"
  >
    <span class="font-medium text-sm">
      Viewing archive<template v-if="dateLabel"> from {{ dateLabel }}</template
      ><template v-if="archiveName"> - "{{ archiveName }}"</template>
    </span>
    <u-button color="amber" size="xs" variant="soft" @click="backToLive">Back To Live</u-button>
  </div>
</template>
