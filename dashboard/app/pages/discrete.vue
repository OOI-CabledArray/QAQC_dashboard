<script lang="ts" setup>
import type { ZonedDateTime } from '@internationalized/date'
import { parseAbsolute } from '@internationalized/date'
import { sortBy, upperFirst } from 'lodash-es'
import Zod from 'zod'

import type { Option } from '@/chart'
import Chart from '@/components/Chart.vue'
import type { Sample, SampleValueType } from '@/discrete'
import { fields, useDiscrete } from '@/discrete'
import { usePersisted } from '@/persisted'

const discrete = useDiscrete()
await discrete.load()

const state = usePersisted({
  schema: Zod.object({
    stations: Zod.string()
      .array()
      .catch(() => []),
    assets: Zod.string()
      .array()
      .catch(() => []),
    x: Zod.string().optional(),
    y: Zod.string().optional().default(fields.depth),
    display: Zod.enum(['scatter', 'line']).catch('scatter'),
    year: Zod.string().optional().catch(undefined),
    month: Zod.string().optional().catch(undefined),
    day: Zod.string().optional().catch(undefined),
  }),
  methods: [{ type: 'url' }],
})

const selectableAssets = $computed(() =>
  discrete.assets.filter(
    (asset) =>
      asset !== 'PI_REQUEST' &&
      (state.stations.length === 0 ||
        state.stations.some((station) => discrete.stationToAssets[station]?.includes(asset))),
  ),
)

watchEffect(() => {
  state.assets = state.assets.filter((asset) => selectableAssets.includes(asset))
})

type NumericFilter = {
  start?: number
  end?: number
  exact?: number
}

function parseNumericFilters(value: string): NumericFilter[] {
  return value
    .split(',')
    .map((current) => current.trim())
    .flatMap((current) => {
      const startRangeMatch = current.replaceAll(' ', '').match(/^(\d+) *-$/)
      if (startRangeMatch != null) {
        const start = parseInt(startRangeMatch[1]!)
        if (!Number.isNaN(start)) {
          return [{ start }]
        }
      }

      const rangeMatch = current.replaceAll(' ', '').match(/^(\d+) *- *(\d+)$/)
      if (rangeMatch != null) {
        const start = parseInt(rangeMatch[1]!)
        const end = parseInt(rangeMatch[2]!)
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          return [{ start, end }]
        }
      }

      const exact = parseInt(current)
      if (!Number.isNaN(exact)) {
        return [{ exact } as NumericFilter]
      }

      return []
    })
}

function matchesNumericFilter(value: number, filter: NumericFilter) {
  return (
    (filter.exact == null || value === filter.exact) &&
    (filter.start == null || value >= filter.start) &&
    (filter.end == null || value <= filter.end)
  )
}

function matchesNumericFilters(value: number, filters: NumericFilter[]) {
  return filters.length === 0 || filters.some((filter) => matchesNumericFilter(value, filter))
}

const timestampFilters = $computed(() => {
  return {
    year: parseNumericFilters(state.year ?? ''),
    month: parseNumericFilters(state.month ?? ''),
    day: parseNumericFilters(state.day ?? ''),
  }
})

function matches(sample: Sample) {
  if (state.stations.length > 0 && !state.stations.includes(sample[fields.station])) {
    return false
  }

  if (state.assets.length > 0 && !state.assets.includes(sample[fields.asset])) {
    return false
  }

  let timestamp: ZonedDateTime
  try {
    timestamp = parseAbsolute(sample[fields.timestamp], 'UTC')
  } catch (error) {
    console.log('Failed to parse date for sample.', error)
    return false
  }

  if (!matchesNumericFilters(timestamp.year, timestampFilters.year)) {
    return false
  }
  if (!matchesNumericFilters(timestamp.month, timestampFilters.month)) {
    return false
  }
  if (!matchesNumericFilters(timestamp.day, timestampFilters.day)) {
    return false
  }

  return true
}

const samples = $computed(() => {
  if (state.x == null || state.y == null) {
    return null
  }

  return sortBy(discrete.samples, state.x).filter(matches)
})

const extents = $computed(() => {
  const extents = {
    year: {
      earliest: undefined as number | undefined,
      latest: undefined as number | undefined,
    },
    month: {
      earliest: undefined as number | undefined,
      latest: undefined as number | undefined,
    },
  }

  const samples = discrete.samples
  if (samples == null || samples.length === 0) {
    return extents
  }

  for (const sample of samples) {
    let timestamp: ZonedDateTime
    try {
      timestamp = parseAbsolute(sample[fields.timestamp], 'UTC')
    } catch (error) {
      console.log('Failed to parse date for sample.', error)
      continue
    }

    if (extents.year.earliest == null || timestamp.year < extents.year.earliest) {
      extents.year.earliest = timestamp.year
    }
    if (extents.year.latest == null || timestamp.year > extents.year.latest) {
      extents.year.latest = timestamp.year
    }

    if (extents.month.earliest == null || timestamp.month < extents.month.earliest) {
      extents.month.earliest = timestamp.month
    }
    if (extents.month.latest == null || timestamp.month > extents.month.latest) {
      extents.month.latest = timestamp.month
    }
  }

  return extents
})

const yearPlaceholder = $computed(() => {
  if (extents.year.earliest != null && extents.year.latest != null) {
    return `${extents.year.earliest} - ${extents.year.latest}`
  }

  return undefined
})

const sampleGroups = $computed(() => {
  if (samples == null) {
    return null
  }

  const groups: Record<string, Sample[]> = {}

  for (const sample of samples) {
    const asset = sample[fields.asset] ?? 'Unknown Asset'
    const { year, month, day } = parseAbsolute(sample[fields.timestamp], 'UTC')

    const groupName = `${asset} (${year}-${month}-${day})`
    let group = groups[groupName] ?? undefined
    if (group == null) {
      group = []
      groups[groupName] = group
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
  if (state.x == null || state.y == null) {
    return ''
  }

  const yLabel = upperFirst(state.y.replaceAll('_', ' '))
  const xLabel = upperFirst(state.x.replaceAll('_', ' '))
  return `${yLabel} / ${xLabel}`
})

const option = $computed(() => {
  if (sampleGroups == null) {
    return null
  }

  const xSchemaFieldDefinition = discrete.schema[state.x ?? '']
  const ySchemaFieldDefinition = discrete.schema[state.y ?? '']
  if (xSchemaFieldDefinition == null || ySchemaFieldDefinition == null) {
    return null
  }

  const xSeriesType = computeSeriesType(xSchemaFieldDefinition.type)
  const ySeriesType = computeSeriesType(ySchemaFieldDefinition.type)

  return {
    grid: {
      top: '24px',
      left: '24px',
      right: '24px',
      bottom: '160px',
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
      {
        type: 'inside',
        yAxisIndex: 0,
      },
      {
        type: 'slider',
        yAxisIndex: 0,
        right: 31,
        showDataShadow: false,
      },
    ],
    legend: {
      show: Object.keys(sampleGroups).length <= 20,
      bottom: 0,
    },
    series: Object.entries(sampleGroups).map(([name, samples]) => ({
      name,
      type: state.display,
      data: samples.map((sample) => [sample[state.x as string], sample[state.y as string]]),
      emphasis: {
        focus: 'series',
      },
      large: true,
      largeThreshold: 100,
    })),
  } satisfies Option
})
</script>

<template>
  <u-page>
    <u-page-body class="px-8">
      <u-page-header title="Discrete Data Plotting" />
      <div class="space-y-2">
        <div class="gap-2 grid grid-cols-1 lg:grid-cols-3 md:grid-cols-2">
          <u-form-field label="Station">
            <u-select-menu
              v-model="state.stations"
              class="w-full"
              :items="discrete.stations"
              multiple
            >
              <template #trailing>
                <clear-button
                  v-if="state.stations.length > 0"
                  v-model="state.stations"
                  :clear-value="() => []"
                />
              </template>
            </u-select-menu>
          </u-form-field>
          <u-form-field label="Asset">
            <u-select-menu
              v-model="state.assets"
              class="w-full"
              :items="
                selectableAssets.map((asset) => ({
                  label:
                    discrete.assetToStation[asset] == null || state.stations.length === 1
                      ? asset
                      : `${asset} (${discrete.assetToStation[asset]})`,
                  value: asset,
                }))
              "
              multiple
              value-key="value"
            >
              <template #trailing>
                <clear-button
                  v-if="state.assets.length > 0"
                  v-model="state.assets"
                  :clear-value="() => []"
                />
              </template>
            </u-select-menu>
          </u-form-field>
          <u-tooltip
            :text="
              'Use hyphens for ranges, and commas for multiple options. ' +
              'Example: \'2016-2018, 2020, 2023-\''
            "
          >
            <u-form-field label="Year">
              <u-input
                v-model="state.year"
                class="w-full"
                :default-value="null"
                :placeholder="yearPlaceholder"
              />
            </u-form-field>
          </u-tooltip>
          <u-form-field class="" label="X-Axis">
            <u-select-menu v-model="state.x" class="w-full" :items="discrete.plottableFields" />
          </u-form-field>
          <u-form-field label="Y-Axis">
            <u-select-menu v-model="state.y" class="w-full" :items="discrete.plottableFields" />
          </u-form-field>
          <u-form-field label="Chart Type">
            <u-select-menu
              v-model="state.display"
              class="w-full"
              :items="
                ['scatter', 'line'].map((value) => ({
                  label: upperFirst(value),
                  value,
                }))
              "
              label-key="label"
              value-key="value"
            />
          </u-form-field>
        </div>
      </div>
      <template v-if="option != null">
        <h2 class="mb-0 text-center text-lg">
          {{ chartTitle }}
        </h2>
        <chart class="h-150" :option="option" />
      </template>
      <p v-else-if="state.y == null" class="text-center text-md">
        Select a Y-Axis value to display the chart.
      </p>
    </u-page-body>
  </u-page>
</template>
