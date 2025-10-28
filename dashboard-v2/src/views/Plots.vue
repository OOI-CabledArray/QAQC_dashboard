<script lang="ts" setup>
import TopNavBar from '@/components/TopNavBar.vue'
import PlotsOverview from '@/components/plots/Overview.vue'

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
    <TopNavBar />
    <div class="flex flex-row justify-center">
      <div class="not-sm:w-full p-8 sm:w-[1200px]">
        <plots-overview
          :data-range="dataRange"
          :keyword="keyword"
          :overlays="overlays"
          :subkey="subkey"
          :time-span="timeSpan"
        />
      </div>
    </div>
  </div>
</template>
