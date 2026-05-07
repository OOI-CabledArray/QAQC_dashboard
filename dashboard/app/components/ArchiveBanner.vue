<script lang="ts" setup>
import { useStore } from '~/store'

const store = useStore()

let archiveName = $ref<string | null>(null)

async function loadArchiveName() {
  if (!store.currentArchive) {
    archiveName = null
    return
  }

  try {
    const archives = await $fetch<any[]>('/api/archives')
    const key = store.currentArchive
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
}

watch(() => store.currentArchive, loadArchiveName, { immediate: true })

const dateLabel = $computed(() => {
  if (!store.currentArchive) {
    return ''
  }
  const datePart = store.currentArchive.slice(0, 10)
  return new Date(datePart + 'T00:00:00').toLocaleDateString('en-US', {
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
      Viewing archive from {{ dateLabel
      }}<template v-if="archiveName"> - "{{ archiveName }}"</template>
    </span>
    <u-button color="amber" size="xs" variant="soft" @click="backToLive">Back To Live</u-button>
  </div>
</template>
