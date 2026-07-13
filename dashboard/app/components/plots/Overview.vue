<script lang="ts" setup>
import type { TabsItem } from '@nuxt/ui'
import { capitalize, forEach, groupBy, sortBy, toNumber, zipObject } from 'lodash-es'
import { watch } from 'vue'

import { useBreakpoints } from '~/breakpoints'
import { isEchosounder, isHydrophone } from '~/instruments'
import { parsePlotFilename } from '~/plotFilename'
import { useStore, type CSVFile } from '~/store'
import { isPNG, isSVG } from '~/utilities'

type BinnedPlotDataValues = {
  ref: string
  variable: string
  depthString: string
  timeSpan: string
  overlays: string
  dataRange: string
}

type BinnedPlot = BinnedPlotDataValues & {
  url: string
  depth: number
  depthUnit: string
}

type ProfilerPlotDataValues = {
  ref: string
  variable: string
  profilerString: string
  timeSpan: string
  overlays: string
  dataRange: string
}

type ProfilerPlot = ProfilerPlotDataValues & {
  url: string
  profile: number
  profUnit: string
}

const {
  keyword,
  subkey,
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

const store = useStore()
const breakpoints = useBreakpoints()

const isWide = $computed(() => (import.meta.client ? breakpoints.greaterOrEqual('lg').value : true))

let filteredPlotList = $ref<string[]>([])

const depthUnit = 'meters'
const profUnit = 'profile'
const tabs = $computed(() => {
  const tabs: TabsItem[] = []
  if (isAcoustic) {
    tabs.push({
      slot: 'spectrograms' as const,
      label: 'Spectrogram Viewer', // TODO dynamically label this spectrogram/echogram
    })
  } else {
    tabs.push({
      slot: 'fixed' as const,
      label: 'Fixed Depths and Colormap Profiles',
    })
  }
  if (hasBinned) {
    tabs.push({
      slot: 'binned' as const,
      label: 'Depth Binned Profiler Data',
    })
  }
  if (hasProfiles) {
    tabs.push({
      slot: 'profiles' as const,
      label: 'Profiles',
    })
  }

  return tabs
})

onMounted(async () => {
  await store.getPlots()
  filterPlotList()
})

const filteredPlots = $computed(() => filteredPlotList.map((plot) => `${store.plotsURL}/${plot}`))
const filteredCSVs = $computed(() => filterCSVs_status(store.csvData))
const csvTables = $computed(() =>
  filteredCSVs.map((csv) => {
    const cleanedData = csv.data.map(
      (line) => zipObject(['ref', 'value'], line) as { ref: string; value: string },
    )
    return {
      name: csv.name.split('_').at(-1) as string,
      data: sortBy(cleanedData, (current) => current.ref.split('-').at(-1)),
    }
  }),
)

// Filenames are parsed from the end (parsePlotFilename), not split positionally —
// a `variable` field with underscores (e.g. spectral_irradiance_412nm) would
// otherwise misalign every field after it.
const binnedPlots: Record<string, Record<string, BinnedPlot[]>> = $computed(() => {
  const binnedCollections = filteredPlotList.flatMap((line) => {
    const info = parsePlotFilename(line)
    if (!info || !info.depthString.endsWith(depthUnit)) return []
    return [
      {
        ref: info.ref,
        variable: info.variable,
        depthString: info.depthString,
        timeSpan: info.timeSpan,
        overlays: info.overlays,
        dataRange: info.dataRange,
        url: getURL(line),
        depth: parseDepth(info.depthString),
        depthUnit: depthUnit,
      } satisfies BinnedPlot,
    ]
  })

  const groupedByRef = groupBy(binnedCollections, (current) => current.ref)
  const groupedByVariable: Record<string, Record<string, BinnedPlot[]>> = {}
  forEach(groupedByRef, (value, key) => {
    groupedByVariable[key] = groupBy(value, (current) => current.variable)
  })

  return groupedByVariable
})

const profilePlots = $computed(() => {
  const profilePlots = filteredPlotList.filter((plot) => {
    if (!plot.endsWith('.png') && !plot.endsWith('.svg')) return false
    const info = parsePlotFilename(plot)
    return !!info && info.depthString === ''
  })

  return createPlotURL(profilePlots).sort()
})

const hasBinned = $computed(() => Object.keys(binnedPlots).length > 0)

const profilerPlots: Record<string, Record<string, ProfilerPlot[]>> = $computed(() => {
  const profilerCollections = filteredPlotList.flatMap((line) => {
    const info = parsePlotFilename(line)
    if (!info || !info.depthString.endsWith(profUnit)) return []
    return [
      {
        ref: info.ref,
        variable: info.variable,
        profilerString: info.depthString,
        timeSpan: info.timeSpan,
        overlays: info.overlays,
        dataRange: info.dataRange,
        url: getURL(line),
        profile: parseProfile(info.depthString),
        profUnit: profUnit,
      } satisfies ProfilerPlot,
    ]
  })

  const groupedByRef = groupBy(profilerCollections, (current) => current.ref)
  const groupedByVariable: Record<string, Record<string, ProfilerPlot[]>> = {}
  forEach(groupedByRef, (value, key) => {
    groupedByVariable[key] = groupBy(value, (current) => current.variable)
  })

  return groupedByVariable
})

const hasProfiles = $computed(() => Object.keys(profilerPlots).length > 0)
const isHydro = $computed(() => isHydrophone(keyword))
const isZpls = $computed(() => isEchosounder(keyword))
const isAcoustic = $computed(() => isHydro || isZpls)

function filterCSVs_status(csvs: CSVFile[]) {
  return csvs.filter((csv) => csv.name.includes('HITL_Status'))
}

function filterPlotList() {
  if (store.hitlStatus.includes('Status')) {
    const plotListHITL: string[] = []
    filteredPlotList = []
    Object.values(csvTables).forEach((csvValue) => {
      if (csvValue.name.includes(keyword)) {
        Object.values(csvValue.data).forEach((dataValue) => plotListHITL.push(dataValue.ref))
      }
    })
    Object.values(store.plotList).forEach((plotValue) => {
      if (plotListHITL.includes(plotValue.split(/\/|_/)[1] as string)) {
        filteredPlotList.push(plotValue)
      }
    })
  } else {
    filteredPlotList = store.plotList
    filteredPlotList = filteredPlotList.filter((plot) => plot.includes(keyword))
    filteredPlotList = filteredPlotList.filter((plot) => plot.includes(subkey))
  }

  filteredPlotList = filteredPlotList.filter((plot) => plot.includes(dataRange))
  filteredPlotList = filteredPlotList.filter((plot) => plot.includes(timeSpan))
  filteredPlotList = filteredPlotList.filter((plot) => plot.includes(overlays))
}

function createPlotURL(plots: string[]) {
  return plots.map(getURL)
}

function getURL(plot: string) {
  return `${store.plotsURL}/${plot}`
}

function parseDepth(depthString: string) {
  const str = depthString.replace(depthUnit, '')
  return toNumber(str)
}

function parseProfile(profileString: string) {
  const str = profileString.replace(profUnit, '')
  return toNumber(str)
}

watch([() => keyword, () => subkey, () => overlays, () => dataRange, () => timeSpan], () => {
  filterPlotList()
})
</script>

<template>
  <div class="text-left">
    <h1 v-if="filteredPlots.length === 0 && !isAcoustic">No plots found.</h1>
    <u-card v-if="filteredPlots.length > 0 || isAcoustic">
      <u-tabs :items="tabs" :size="isWide ? 'md' : 'xs'">
        <template #fixed>
          <template v-for="url in profilePlots" :key="url">
            <img v-if="isPNG(url)" class="h-auto max-w-full" loading="lazy" :src="url" />
            <object
              v-if="isSVG(url)"
              class="block h-auto max-w-375 w-full"
              :data="url"
              type="image/svg+xml"
            />
          </template>
        </template>
        <template #spectrograms>
          <acoustic-viewer
            v-if="isHydro"
            :base-path="store.spectrogramsURL"
            :instruments="store.hydrophones"
          />
          <acoustic-viewer
            v-else-if="isZpls"
            :base-path="store.echogramsURL"
            :instruments="store.echosounders"
          />
          <div v-else>No instruments selected for this viewer.</div>
        </template>
        <template #binned>
          <div v-for="(vars, key) in binnedPlots" :key="key" class="mb-8">
            <h2 class="mb-1 md:text-lg mt-2 text-sm">
              {{ key }}
            </h2>
            <u-card class="p-0">
              <u-tabs
                :items="
                  Object.entries(vars).map(([varkey, plots]) => ({
                    label: capitalize(varkey),
                    varkey,
                    plots,
                  }))
                "
                :orientation="isWide ? 'vertical' : 'horizontal'"
                :size="isWide ? 'md' : 'xs'"
              >
                <template #content="{ item }">
                  <div class="px-2">
                    <binned-viewer :plots="item.plots" :refdes="key" :variable="item.varkey" />
                  </div>
                </template>
              </u-tabs>
            </u-card>
          </div>
        </template>
        <template #profiles>
          <div v-for="(vars, key) in profilerPlots" :key="key" class="mb-8">
            <h2 class="mb-1 md:text-lg mt-2 text-sm">
              {{ key }}
            </h2>
            <u-card class="p-0">
              <u-tabs
                :items="
                  Object.entries(vars).map(([varkey, plots]) => ({
                    label: capitalize(varkey),
                    varkey,
                    plots,
                  }))
                "
                :orientation="isWide ? 'vertical' : 'horizontal'"
                :size="isWide ? 'md' : 'xs'"
              >
                <template #content="{ item }">
                  <profile-viewer :plots="item.plots" :refdes="key" :variable="item.varkey" />
                </template>
              </u-tabs>
            </u-card>
          </div>
        </template>
      </u-tabs>
    </u-card>
  </div>
</template>
