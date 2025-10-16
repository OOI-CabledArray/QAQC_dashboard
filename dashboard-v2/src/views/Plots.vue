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
