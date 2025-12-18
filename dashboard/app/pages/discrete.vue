<script lang="ts" setup>
import { sortBy, upperFirst } from 'lodash-es'
import Zod from 'zod'

import type { Option } from '@/chart'
import Chart from '@/components/Chart.vue'
import type { Sample, SampleValueType } from '@/discrete'
import { useDiscrete, fields } from '@/discrete'
import { usePersisted } from '@/persistence'

const discrete = useDiscrete()
await discrete.load()

const state = usePersisted({
  schema: Zod.object({
    station: Zod.string().array().optional(),
    assets: Zod.string().array().optional(),
    cruise: Zod.string().array().optional(),
    x: Zod.string().default(fields.time),
    y: Zod.string().optional(),
    display: Zod.enum(['scatter', 'line']).default('scatter'),
  }),
  methods: [{ type: 'url' }],
})

const samples = $computed(() => {
  if (state.y == null) {
    return null
  }

  return sortBy(discrete.samples, state.x).filter((sample) => {
    return (
      (state.station == null || state.station.includes(sample[fields.station])) &&
      (state.assets == null || state.assets.includes(sample[fields.asset])) &&
      (state.cruise == null || state.cruise.includes(sample[fields.cruise]))
    )
  })
})

const samplesByAsset = $computed(() => {
  if (samples == null) {
    return null
  }

  const groups: Record<string, Sample[]> = {}

  for (const sample of samples) {
    const asset = sample[fields.asset]
    let group = groups[asset] ?? undefined
    if (group == null) {
      group = []
      groups[asset] = group
    }

    group.push(sample)
  }

  return groups
})

function computeSeriesType(schemaType: SampleValueType) {
  switch (schemaType) {
    case 'timestamp':
      return 'time'
    case 'number':
      return 'value'
    case 'text':
      return 'category'
  }
}

const chartTitle = $computed(() => {
  if (state.y == null) {
    return ''
  }

  const yLabel = upperFirst(state.y.replaceAll('_', ' '))
  const xLabel = upperFirst(state.x.replaceAll('_', ' '))
  return `${yLabel} / ${xLabel}`
})

const option = $computed(() => {
  if (samplesByAsset == null) {
    return null
  }

  const xSchemaFieldDefinition = discrete.schema[state.x]
  const ySchemaFieldDefinition = state.y != null ? discrete.schema[state.y] : null
  if (xSchemaFieldDefinition == null || ySchemaFieldDefinition == null) {
    return null
  }

  const xSeriesType = computeSeriesType(xSchemaFieldDefinition.type)
  const ySeriesType = computeSeriesType(ySchemaFieldDefinition.type)

  return {
    animation: false,
    grid: {
      left: '24px',
      right: '24px',
      bottom: '140px',
    },
    tooltip: {
      confine: true,
      enterable: true,
      trigger: 'axis',
    },
    xAxis: {
      name: state.x,
      type: xSeriesType,
    },
    yAxis: {
      name: state.y,
      type: ySeriesType,
    },
    dataZoom: [
      {
        type: 'inside',
      },
      {
        type: 'slider',
        bottom: 80,
      },
    ],
    legend: {
      show: true,
    },
    series: Object.entries(samplesByAsset).map(([asset, samples]) => ({
      name: asset,
      type: state.display,
      data: samples.map((sample) => [sample[state.x], sample[state.y as string]]),
      emphasis: {
        focus: 'series',
      },
    })),
  } satisfies Option
})
</script>

<template>
  <u-page>
    <u-page-body class="px-8">
      <u-page-header title="Discrete Data Chart" />
      <div class="space-y-2">
        <div class="gap-2 grid grid-cols-3 max-md:grid-cols-2">
          <u-form-field label="Station">
            <u-select-menu
              class="w-full"
              :items="discrete.stations"
              :model-value="state.station"
              multiple
              @update:model-value="
                (value) => (state.station = value.length > 0 ? value : undefined)
              "
            >
              <template #trailing>
                <clear-button v-if="state.station != null" v-model="state.station" />
              </template>
            </u-select-menu>
          </u-form-field>
          <u-form-field label="Asset">
            <u-select-menu
              class="w-full"
              :items="discrete.assets"
              :model-value="state.assets"
              multiple
              @update:model-value="(value) => (state.assets = value.length > 0 ? value : undefined)"
            >
              <template #trailing>
                <clear-button v-if="state.assets != null" v-model="state.assets" />
              </template>
            </u-select-menu>
          </u-form-field>
          <u-form-field label="Cruise">
            <u-select-menu
              class="w-full"
              :items="discrete.cruises"
              :model-value="state.cruise"
              multiple
              @update:model-value="(value) => (state.cruise = value.length > 0 ? value : undefined)"
            >
              <template #trailing>
                <clear-button v-if="state.cruise != null" v-model="state.cruise" />
              </template>
            </u-select-menu>
          </u-form-field>
          <div class="flex flex-row justify-between">
            <u-form-field class="flex-1" label="Chart Type">
              <u-select-menu
                v-model="state.display"
                class="w-full"
                :items="
                  ['line', 'scatter'].map((value) => ({
                    label: upperFirst(value),
                    value,
                  }))
                "
                label-key="label"
                value-key="value"
              />
            </u-form-field>
          </div>
          <u-form-field label="Y-Axis">
            <u-select-menu v-model="state.y" class="w-full" :items="discrete.plottableFields" />
          </u-form-field>
          <u-form-field label="X-Axis">
            <u-select-menu v-model="state.x" class="w-full" :items="discrete.plottableFields" />
          </u-form-field>
        </div>
      </div>
      <template v-if="option != null">
        <h2 class="mb-0 text-center text-lg">
          {{ chartTitle }}
        </h2>
        <chart class="h-[600px]" :option="option" />
      </template>
      <p v-else-if="state.y == null" class="text-center text-md">
        Select a Y-Axis value to display the chart.
      </p>
    </u-page-body>
  </u-page>
</template>
