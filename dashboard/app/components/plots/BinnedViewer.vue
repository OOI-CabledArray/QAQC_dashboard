<script lang="ts" setup>
import { sortBy } from 'lodash-es'

import { isPNG, isSVG } from '@/utilities'

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
</script>

<template>
  <div>
    <template v-if="currentPlot != null">
      <img v-if="isPNG(currentPlot.url)" class="w-full" :src="currentPlot.url" />
      <object
        v-else-if="isSVG(currentPlot.url)"
        :key="currentPlot.url"
        class="h-auto w-full"
        :data="currentPlot.url"
        type="image/svg+xml"
      />
    </template>
    <div class="p-4">
      <u-slider v-model="depthIndex" :max="depths.length - 1" :min="0" size="sm" />
    </div>
  </div>
</template>
