<script lang="ts" setup>
import { sortBy } from 'lodash-es'

type Plot = { profile: number; url: string }

const { plots } = defineProps<{
  plots: Plot[]
  variable: string
  refdes: string
}>()

const profileIndex = $ref(0)

function isSVG(url: string) {
  return url.toLowerCase().endsWith('.svg')
}

function isPNG(url: string) {
  return url.toLowerCase().endsWith('.png')
}

const sortedPlots = $computed(() => sortBy(plots, (plot) => plot.profile))
const profiles = $computed(() => sortedPlots.map((plot) => plot.profile))
const currentPlot = $computed(() => sortedPlots[profileIndex])
</script>

<template>
  <div>
    <b-form-input
      :id="`${refdes}--${variable}--selector`"
      v-model="profileIndex"
      :max="profiles.length - 1"
      min="0"
      type="range"
    />
    <template v-if="currentPlot != null">
      <b-img v-if="isPNG(currentPlot.url)" fluid lazy :src="currentPlot.url" />
      <object
        v-if="isSVG(currentPlot.url)"
        :key="currentPlot.url"
        class="svg-object"
        :data="currentPlot.url"
        type="image/svg+xml"
      />
    </template>
  </div>
</template>

<style scoped>
.svg-object {
  width: 100%;
  height: auto; /* This will maintain the aspect ratio */
}
</style>
