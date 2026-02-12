<script lang="ts" setup>
const {
  keyword = '-',
  subkey = '-',
  dataRange = 'full',
  timeSpan = 'week',
  overlays = 'none',
} = defineProps<{
  keyword?: string
  subkey?: string
  dataRange?: string
  timeSpan?: string
  overlays?: string
}>()

const pageTitle = keyword.trim() !== '-' ? `Plots for ${keyword.trim()}` : 'Plots'

useHead({
  titleTemplate: () => `${pageTitle} | %s`,
})
</script>

<template>
  <client-only>
    <div>
      <top-nav-bar />
      <div class="p-4">
        <overview
          :data-range="dataRange"
          :keyword="keyword"
          :overlays="overlays"
          :subkey="subkey"
          :time-span="timeSpan"
        />
      </div>
    </div>
  </client-only>
</template>
