<script lang="ts" setup>
definePageMeta({
  props: true,
})

const {
  dataRange = 'full',
  timeSpan = 'week',
  overlays = 'none',
} = defineProps<{
  keyword: string
  subkey: string
  dataRange?: string
  timeSpan?: string
  overlays?: string
}>()
</script>

<template>
  <div>
    <top-nav-bar />
    <div class="p-4">
      <plots-overview
        :data-range="dataRange"
        :keyword="keyword"
        :overlays="overlays"
        :subkey="subkey"
        :time-span="timeSpan"
      />
    </div>
  </div>
</template>
