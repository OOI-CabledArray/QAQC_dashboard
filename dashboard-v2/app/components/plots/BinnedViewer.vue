<script lang="ts" setup>
import { sortBy } from 'lodash-es'

type Plot = { depth: number; url: string }

const { plots } = defineProps<{
  plots: Plot[]
  variable: string
  refdes: string
}>()

const depthIndex = $ref(0)

const sortedPlots = $computed(() => sortBy(plots, (plot) => plot.depth))
const depths = $computed(() => sortedPlots.map((plot) => plot.depth))
const currentPlot = $computed(() => sortedPlots[depthIndex])

function isSVG(url: string) {
  return url.toLowerCase().endsWith('.svg')
}

function isPNG(url: string) {
  return url.toLowerCase().endsWith('.png')
}
</script>

<template>
  <div>
    <b-form-input
      :id="`${refdes}--${variable}--selector`"
      v-model="depthIndex"
      :max="depths.length - 1"
      min="0"
      type="range"
    />
    <template v-if="currentPlot != null">
      <b-img v-if="isPNG(currentPlot.url)" fluid lazy :src="currentPlot.url" />
      <object
        v-else-if="isSVG(currentPlot.url)"
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
