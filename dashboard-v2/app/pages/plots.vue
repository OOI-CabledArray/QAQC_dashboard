<script lang="ts" setup>
definePageMeta({
  props: (route) => ({ ...route.query }),
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
