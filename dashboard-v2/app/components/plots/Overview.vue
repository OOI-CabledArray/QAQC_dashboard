<script lang="ts" setup>
import { capitalize, forEach, groupBy, sortBy, toNumber, zipObject } from 'lodash-es'
import { onMounted, watch } from 'vue'

import { useStore, type CSVFile } from '@/store'

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

let filteredPlotList = $ref<string[]>([])

const depthUnit = 'meters'
const profUnit = 'profile'

onMounted(async () => {
  // Load plots even when user doesn't navigate to the home page first.
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

const binnedPlots: Record<string, Record<string, BinnedPlot[]>> = $computed(() => {
  const binnedPlotLines = filteredPlotList.filter((plot) => plot.includes(depthUnit))
  const binnedCollections = binnedPlotLines.map((line) => {
    const names = (line.split('/').at(-1) as string).replace('.png', '').split('_')
    const plot = zipObject(
      ['ref', 'variable', 'depthString', 'timeSpan', 'overlays', 'dataRange'],
      names,
    ) as BinnedPlotDataValues

    return {
      ...plot,
      url: getURL(line),
      depth: parseDepth(plot.depthString),
      depthUnit: depthUnit,
    } satisfies BinnedPlot
  })

  const groupedByRef = groupBy(binnedCollections, (current) => current.ref)
  const groupedByVariable: Record<string, Record<string, BinnedPlot[]>> = {}
  forEach(groupedByRef, (value, key) => {
    groupedByVariable[key] = groupBy(value, (current) => current.variable)
  })

  return groupedByVariable
})

const profilePlots = $computed(() => {
  const profilePlots = filteredPlotList.filter(
    (plot) =>
      (plot.endsWith('.png') || plot.endsWith('.svg')) &&
      !plot.includes(depthUnit) &&
      !plot.includes(profUnit),
  )
  console.log('profile plots:', createPlotURL(profilePlots).sort())
  return createPlotURL(profilePlots).sort()
})

const hasBinned = $computed(() => Object.keys(binnedPlots).length > 0)

const profilerPlots: Record<string, Record<string, ProfilerPlot[]>> = $computed(() => {
  const profilerPlots = filteredPlotList.filter((plot) => plot.includes(profUnit))
  const profilerCollections = profilerPlots.map((line) => {
    const names = (line.split('/').at(-1) as string).replace('.png', '').split('_')
    const plot = zipObject(
      ['ref', 'variable', 'profilerString', 'timeSpan', 'overlays', 'dataRange'],
      names,
    ) as ProfilerPlotDataValues

    return {
      ...plot,
      url: getURL(line),
      profile: parseProfile(plot.profilerString),
      profUnit: profUnit,
    } satisfies ProfilerPlot
  })

  const groupedByRef = groupBy(profilerCollections, (current) => current.ref)
  const groupedByVariable: Record<string, Record<string, ProfilerPlot[]>> = {}
  forEach(groupedByRef, (value, key) => {
    groupedByVariable[key] = groupBy(value, (current) => current.variable)
  })

  return groupedByVariable
})

const hasProfiles = $computed(() => Object.keys(profilerPlots).length > 0)
const isHydrophone = $computed(() => keyword === 'HYDBB' || keyword === 'HYDLF')

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

function toTitle(text: string) {
  return capitalize(text)
}

function isSVG(url: string) {
  return url.toLowerCase().endsWith('.svg')
}

function isPNG(url: string) {
  return url.toLowerCase().endsWith('.png')
}

watch([() => keyword, () => subkey, () => overlays, () => dataRange, timeSpan], () => {
  filterPlotList()
})
</script>

<template>
  <div class="text-left">
    <h1 v-if="filteredPlots.length === 0 && !isHydrophone">No Plots found.</h1>
    <u-card v-if="filteredPlots.length > 0 || isHydrophone" no-body>
      <u-tabs value="0">
        <!-- <TabList>
          <Tab v-if="!isHydrophone" value="0">Fixed Depths and Colormap Profiles</Tab>
          <Tab v-if="isHydrophone" value="1">Spectrogram Viewer</Tab>
          <Tab v-if="hasProfiles" value="2">Profiles</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="0">
            <div v-for="(vars, key) in binnedPlots" :key="key">
              <h5>
                {{ key }}
              </h5>
              <Card no-body>
                <Tabs :value="0">
                  <b-tab v-for="(plots, varkey) in vars" :key="varkey" :title="toTitle(varkey)">
                    <BinnedViewer :plots="plots" :refdes="key" :variable="varkey" />
                  </b-tab>
                </Tabs>
              </Card>
              <hr />
            </div>
          </TabPanel>
          <TabPanel value="1">
            <HydrophoneViewer />
          </TabPanel>
          <TabPanel value="1">
            <HydrophoneViewer />
          </TabPanel>
        </TabPanels> -->
      </u-tabs>

      <!-- <b-tab v-if="hasBinned" title="Depth Binned Profiler Data">
          <div v-for="(vars, key) in binnedPlots" :key="key">
            <h5>
              {{ key }}
            </h5>
            <b-card no-body>
              <b-tabs card pills vertical>
                <b-tab v-for="(plots, varkey) in vars" :key="varkey" :title="toTitle(varkey)">
                  <BinnedViewer :plots="plots" :refdes="key" :variable="varkey" />
                </b-tab>
              </b-tabs>
            </b-card>
            <hr />
          </div>
        </b-tab> -->
      <!-- <b-tab v-if="hasProfiles" title="Profiles">
          <div v-for="(vars, key) in profilerPlots" :key="key">
            <h5>
              {{ key }}
            </h5>
            <b-card no-body>
              <b-tabs card pills vertical>
                <b-tab v-for="(plots, varkey) in vars" :key="varkey" :title="toTitle(varkey)">
                  <ProfileViewer :plots="plots" :refdes="key" :variable="varkey" />
                </b-tab>
              </b-tabs>
            </b-card>
            <hr />
          </div>
        </b-tab> -->
    </u-card>
  </div>
</template>

<style>
.svg-object {
  width: 100%;
  max-width: 1500px;
  height: auto; /* This will maintain the aspect ratio */
}
</style>
