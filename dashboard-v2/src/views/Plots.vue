<script lang="ts" setup>
import PlotsOverview from '@/components/Plots/Overview.vue'
import TopNavBar from '@/components/TopNavBar.vue'

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
    <b-container fluid>
      <b-row>
        <b-col>
          <plots-overview
            :data-range="dataRange"
            :keyword="keyword"
            :overlays="overlays"
            :subkey="subkey"
            :time-span="timeSpan"
          />
        </b-col>
      </b-row>
    </b-container>
  </div>
</template>
