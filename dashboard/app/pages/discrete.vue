<script lang="ts" setup>
import { useEventListener } from '@vueuse/core'
import type { SeriesOption } from 'echarts'
import { cloneDeep, compact, orderBy, uniq, uniqBy, upperFirst } from 'lodash-es'
import Zod from 'zod'

import type { Option } from '@/chart'
import Chart from '@/components/Chart.vue'
import type { Sample, SampleSchemaFieldDefinition, SampleValue } from '@/discrete'
import { useDiscrete } from '@/discrete'
import { usePersisted } from '@/persisted'
import { isMac } from '@/platform'
import { useUndo } from '@/undo'

// Load discrete data.
const discrete = useDiscrete()
await discrete.load()

// Pre-defined colors for new series when first inserted.
const chartColors = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
] as const

// Generate a random color for a series.
function getRandomColor() {
  return (
    '#' +
    Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, '0')
  )
}

// Schema for data series objects in form.
const SeriesSchema = Zod.object({
  asset: Zod.string().optional(),
  x: Zod.string().optional(),
  y: Zod.string().optional(),
  year: Zod.number().optional(),
  display: Zod.enum(['scatter', 'line']).default('scatter'),
  enabled: Zod.boolean().default(true),
  color: Zod.string().default(chartColors[0]),
})

// State for the page, stored as query parameters in the URL.
const state = usePersisted({
  schema: Zod.object({
    series: SeriesSchema.array().default(() => [SeriesSchema.parse({})] as any),
  }),
  methods: [{ type: 'url' }],
})

const ctrlKey = isMac ? 'Command' : 'Ctrl'

// Implement undo/redo for modifying the page's state.
const history = useUndo({
  initial: state,
  onUndo(values) {
    Object.assign(state, values)
  },
  onRedo(values) {
    Object.assign(state, values)
  },
})

// Fields for series which may or may not be completely filled out.
type PartialSeries = (typeof state)['series'][number]
// Fully defined series with included index.
type Series = Required<PartialSeries>

// Fields in series objects used for filtering samples.
type SeriesFilterFields = Pick<PartialSeries, 'asset' | 'x' | 'y' | 'year'>

// Assets that can be selected for plotting.
const selectableAssets = $computed(() => discrete.assets.filter((asset) => asset !== 'PI_REQUEST'))

// Return `true` if the filtering fields on the provided series matche the given sample.
function matches(series: SeriesFilterFields, sample: Sample) {
  return (
    (series.asset == null || sample.asset === series.asset) &&
    (series.x == null || sample.data[series.x] != null) &&
    (series.y == null || sample.data[series.y] != null) &&
    (series.year == null || sample.timestamp.year === series.year)
  )
}

// All series with filter fields completely filled out.
const series = $computed(
  () =>
    compact(
      state.series.map((series) =>
        series.enabled &&
        (series.x ?? series.y) != null &&
        series.asset != null &&
        series.year != null
          ? series
          : null,
      ),
    ).map((group, index) => ({
      index,
      ...group,
    })) as Series[],
)

// True if all series share the same X axis value.
const xAxiesAreSame = $computed(() => uniq(compact(series.map((series) => series.x))).length <= 1)
// True if all series share the same Y axis value.
const yAxiesAreSame = $computed(() => uniq(compact(series.map((series) => series.y))).length <= 1)
// True if all series share the same X and Y axis values.
const allAxiesAreSame = $computed(() => xAxiesAreSame && yAxiesAreSame)

// Cache of missing data checks for series fields.
const isNoDataResultCache: Record<string, boolean> = {}

/**
 * Return `true` if the provided series should show an indication of missing data for the given
 * field, and `false` otherwise. The results of this are cached for performance, considering this
 * is run for all values in the pages select dropdown menus, and usually more than once.
 * */
function isNoData(series: SeriesFilterFields, field: keyof SeriesFilterFields) {
  const key = [series.asset ?? '', series.x ?? '', series.y ?? '', series.year ?? '', field].join(
    ',',
  )
  const cached = isNoDataResultCache[key]
  if (cached != null) {
    return cached
  }

  let result: boolean
  if (field === 'asset') {
    result =
      series.asset != null && discrete.samples.every((sample) => sample.asset !== series.asset)
  } else if (field === 'x') {
    result =
      series.asset != null &&
      series.x != null &&
      discrete.samples
        .filter((sample) => sample.asset === series.asset)
        .every((sample) => sample.data[series.x!] == null)
  } else if (field === 'y') {
    result =
      series.asset != null &&
      series.y != null &&
      discrete.samples
        .filter((sample) => sample.asset === series.asset)
        .every((sample) => sample.data[series.y!] == null)
  } else if (field === 'year') {
    result =
      series.asset != null &&
      series.x != null &&
      series.y != null &&
      series.year != null &&
      !discrete.samples.some(
        (current) =>
          current.asset === series.asset &&
          current.data[series.x!] != null &&
          current.data[series.y!] != null &&
          current.timestamp.year === series.year,
      )
  } else {
    result = false
  }

  isNoDataResultCache[key] = result
  return result
}

// Return a string to indicate if no data is present for the given series field.
function getNoDataIndicator(series: SeriesFilterFields, field: keyof SeriesFilterFields) {
  return isNoData(series, field) ? ' (No Data)' : ''
}

// All years we have discrete sample for.
const yearOptions = $computed(() => {
  return [...new Set(discrete.samples.map((sample) => sample.timestamp.year))].sort()
})

// An ECharts series option with data points and axis labels.
type ChartedSeries = SeriesOption & {
  data: [SampleValue, SampleValue][]
  itemStyle?: any
  lineStyle?: any

  // Store axis labels for tooltip rendering.
  xAxisLabel: string
  yAxisLabel: string
}

// Computed ECharts series options with data points.
const chartedSeries = $computed<ChartedSeries[]>(() => {
  // Mapping of series names to ECharts series options.
  const mapping: Record<string, ChartedSeries> = {}
  const samples = orderBy(discrete.samples, (sample) => sample.timestamp.toDate())

  for (const sample of samples) {
    for (const [seriesIndex, current] of series.entries()) {
      // If the current series does not match this sample, skip it.
      if (!matches(current, sample)) {
        continue
      }

      // We need to create unique series names depending on which axies are the same/different.
      let name: string
      if (allAxiesAreSame) {
        // All axies are the same, so just specify asset and year.
        name = `${sample.asset} (${sample.timestamp.year})`
      } else if (xAxiesAreSame) {
        // Only X axies are the same, so specify asset, year and the distinct Y axis.
        name = `${sample.asset} (${sample.timestamp.year}) — ${current.y}`
      } else if (yAxiesAreSame) {
        // Only Y axies are the same, so specify asset, year and the distinct X axis.
        name = `${sample.asset} (${sample.timestamp.year}) — ${current.x}`
      } else {
        // Both axies are the different, so specify asset, year, and both the Y and X axis.
        name = `${sample.asset} (${sample.timestamp.year}) — ${current.y} / ${current.x}`
      }

      // Unique key of the series to append data points to.
      const seriesKey = `${seriesIndex}\\${name}`

      let series: ChartedSeries = mapping[seriesKey]!
      if (series == null) {
        series = {
          name,
          type: current.display,
          emphasis: { focus: 'series' },
          data: [],
          // Not used by ECharts, stored here for tooltip rendering.
          xAxisLabel: current.x,
          yAxisLabel: current.y,
        }

        series.itemStyle = { color: current.color }
        if (current.display === 'line') {
          series.lineStyle = { color: current.color }
        }

        mapping[seriesKey] = series
      }

      const x = sample.data[current.x]
      const y = sample.data[current.y]
      // Append data point if both X and Y axis values are present.
      if (x != null && y != null) {
        series.data.push([x, y])
      }
    }
  }

  // Ensure data points are ordered and unique.
  for (const current of Object.values(mapping)) {
    // Order by X axis value.
    current.data = orderBy(current.data, ([x]) => x)
    // Ensure all data points are unique.
    current.data = uniqBy(current.data, ([x, y]) => x + '|' + y)
  }

  return Object.values(mapping)
})

// Determine the type of an ECharts axis based on the sample field definitions which will be
// plotted on that axis.
function computeChartedSeriesType(definitions: SampleSchemaFieldDefinition[]) {
  if (definitions.every((definition) => definition.type === 'timestamp')) {
    return 'time'
  }
  if (definitions.every((definition) => definition.type === 'number')) {
    return 'value'
  }

  return 'category'
}

// Label to display on the X axis.
const xAxisLabel = $computed(() =>
  upperFirst(uniq(series.map((current) => current.x.replaceAll('_', ' '))).join(', ')),
)
// Label to display on the Y axis.
const yAxisLabel = $computed(() =>
  upperFirst(uniq(series.map((current) => current.y.replaceAll('_', ' '))).join(', ')),
)

// Invert the Y axis if depth is selected.
const invertYAxis = $computed(() =>
  series.every((series) => (series.y ?? '').toLowerCase().includes('depth')),
)

// Shown alongside select labels to show there is a modifier currently being applied.
const itemLabelModifier = $computed(() => {
  let modifier = ''
  if (isApplyingToAll) {
    modifier = '*'
  } else if (isCreatingNew) {
    modifier = '+'
  }

  return modifier
})

// Rendered ECharts chart option value.
const option = $computed(() => {
  const xSchemaFieldDefinitions = compact(series.map((group) => discrete.schema[group.x]))
  const ySchemaFieldDefinitions = compact(series.map((group) => discrete.schema[group.y]))
  if (xSchemaFieldDefinitions.length === 0 || ySchemaFieldDefinitions.length === 0) {
    return null
  }

  const xAxisType = computeChartedSeriesType(xSchemaFieldDefinitions)
  const yAxisType = computeChartedSeriesType(ySchemaFieldDefinitions)

  return {
    grid: {
      top: '24px',
      left: '40px',
      right: '40px',
      bottom: '160px',
    },
    tooltip: {
      confine: true,
      enterable: true,
      trigger: 'axis',
      // Show both axis values for all hovered points.
      formatter: (points: any) => {
        const content = ['<div class="space-y-2">']
        for (const point of points) {
          const {
            seriesName,
            seriesIndex,
            data: [x, y],
            color,
          } = point

          const series = chartedSeries[seriesIndex]
          if (series == null) {
            continue
          }

          content.push(`
            <div>
              <div class="flex items-center mb-1">
                <div class="w-3 h-3 rounded-full mr-1.5" style="background-color: ${color}">
              </div>
              <b>${seriesName}</b>
              </div>
              ${series.yAxisLabel}: <b>${y}</b><br/>
              ${series.xAxisLabel}: <b>${x}</b><br/>
            </div>
          `)
        }

        content.push('</div>')
        return content.join('')
      },
    },
    xAxis: {
      name: xAxisLabel,
      type: xAxisType,
      nameLocation: 'middle',
      nameTextStyle: {
        align: 'center',
      },
    },
    yAxis: {
      name: yAxisLabel,
      type: yAxisType,
      inverse: invertYAxis,
      nameLocation: invertYAxis ? 'start' : 'end',
    },
    dataZoom: [
      {
        type: 'inside',
      },
      {
        type: 'slider',
        bottom: 80,
        height: 22,
        showDetail: false,
        showDataShadow: false,
      },
      {
        type: 'slider',
        yAxisIndex: 0,
        width: 22,
        top: 22,
        right: 16,
        showDetail: false,
        showDataShadow: false,
      },
    ],
    legend: {
      show: chartedSeries.length <= 20,
      bottom: 0,
    },
    series: chartedSeries,
  } satisfies Option
})

function addSeries({
  index,
  copy,
  changes,
}: {
  index?: number
  copy?: Readonly<PartialSeries>
  changes?: Record<string, any>
} = {}) {
  if (index == null) {
    index = state.series.length
  }
  if (copy == null) {
    copy = state.series[index - 1]
  }
  const created = {
    ...SeriesSchema.parse(cloneDeep(copy ?? {}) as any),
    color: chartColors[state.series.length] ?? getRandomColor(),
  }

  if (changes != null) {
    Object.assign(created, cloneDeep(changes))
  }

  state.series.splice(index, 0, created)
  history.save(state)
  return created
}

function removeSeries(index?: number) {
  if (index == null) {
    index = state.series.length - 1
  }

  if (index < 0 || index >= state.series.length) {
    return null
  }

  const removed = state.series.splice(index, 1)[0]
  history.save(state)
  return removed
}

function moveSeriesUp(index: number) {
  const series = state.series[index]
  const previous = state.series[index - 1]
  if (series == null || previous == null) {
    return
  }

  state.series[index - 1] = series
  state.series[index] = previous

  history.save(state)
}

function moveSeriesDown(index: number) {
  const series = state.series[index]
  const next = state.series[index + 1]
  if (series == null || next == null) {
    return
  }

  state.series[index + 1] = series
  state.series[index] = next

  history.save(state)
}

// Indicates the "Shift" key is currently held.
let isShiftPressed = $ref(false)
// Indicates the "Ctrl" (or "Command" on Mac) key is currently held.
let isCtrlPressed = $ref(false)

// If `true` and changes to a data series will be applied to all series.
const isApplyingToAll = $computed(() => isShiftPressed)
// If `true` any changes to a data series will instead create a new series with that change.
const isCreatingNew = $computed(() => isCtrlPressed)

// Update modifier key states when a key is released.
useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Shift' || event.shiftKey) {
    isShiftPressed = true
  }
  if (event.key === 'Control' || event.ctrlKey || event.key === 'Command' || event.metaKey) {
    isCtrlPressed = true
  }
})

// Update modifier key states when a key is released.
useEventListener('keyup', (event: KeyboardEvent) => {
  if (event.key === 'Shift' || !event.shiftKey) {
    isShiftPressed = false
  }
  if (event.key === 'Control' || !event.ctrlKey || event.key === 'Command' || !event.metaKey) {
    isCtrlPressed = false
  }
})

// Reset modifier keys when the browser tab loses focus. Otherwise, they can get stuck in the
// pressed state if the user switches away from the page while holding them, due to the key up event
// never being received.
useEventListener('blur', () => {
  isShiftPressed = false
  isCtrlPressed = false
})

// Handler for when a field on a data series at a given index is changed by the user. The behavior
// of this changes depending on which modifier keys are held.
function setSeriesField<K extends keyof PartialSeries>(
  index: number,
  field: K,
  value: PartialSeries[K],
) {
  // The series (possibly) being modified.
  const series = state.series[index]
  if (series == null) {
    return
  }

  if (isCtrlPressed) {
    // Create a new series with the changed value.
    addSeries({ index: index + 1, copy: series, changes: { [field]: value } })
  } else if (isShiftPressed) {
    // Apply the change to all series.
    for (const current of state.series) {
      current[field] = value
    }
    history.save(state)
  } else {
    // Apply the change to just the current series.
    series[field] = value
    history.save(state)
  }
}
</script>

<template>
  <u-page>
    <u-page-body class="px-8 space-y-4">
      <u-page-header title="Discrete Data Plotting" />
      <div>
        <div class="flex items-center mb-2 space-x-2">
          <h2 class="font-bold mb-0 mr-2 text-xl">Series</h2>
          <u-popover>
            <u-button
              class="cursor-pointer p-1 rounded-full"
              icon="i-lucide-help-circle"
              label="Tips"
              size="xs"
              variant="subtle"
            />
            <template #content>
              <ul class="p-2 space-y-2 text-xs">
                <li>
                  Use the <code>+</code> and <code>−</code> buttons to add or remove a plotted data
                  series.
                </li>
                <li>
                  Use <code>{{ ctrlKey }}-Z</code> and <code>{{ ctrlKey }}-Shift-Z</code> to
                  undo/redo changes.
                </li>
                <li>
                  Hold <code>Shift</code> while changing the value of a series to apply that change
                  to all series. This is indicated by "<code>*</code>".
                </li>
                <li>
                  Hold <code>{{ ctrlKey }}</code> while changing the value of a series to create a
                  new series with that value. This is indicated by "<code>+</code>".
                </li>
              </ul>
            </template>
          </u-popover>
          <u-tooltip text="Undo">
            <u-button
              :disabled="!history.canUndo"
              icon="i-lucide-undo"
              size="xs"
              variant="subtle"
              @click="history.undo()"
            />
          </u-tooltip>
          <u-tooltip text="Redo">
            <u-button
              :disabled="!history.canRedo"
              icon="i-lucide-redo"
              size="xs"
              variant="subtle"
              @click="history.redo()"
            />
          </u-tooltip>
        </div>
        <div class="space-y-1">
          <u-card variant="subtle">
            <template v-for="(series, i) of state.series" :key="i">
              <div
                :class="[
                  'flex flex-column flex-wrap space-x-2 space-y-1',
                  !series.enabled && 'opacity-80',
                ]"
              >
                <u-form-field class="min-[1680px]:flex-1 min-w-90 w-full" size="sm">
                  <template #label>
                    <span class="flex items-center">
                      <span class="cursor-pointer flex items-center">
                        <span>Asset</span>
                        <u-tooltip text="Toggle Shown">
                          <u-checkbox
                            aria-label="Toggle Shown"
                            class="ml-2"
                            :model-value="series.enabled"
                            size="xs"
                            @update:model-value="
                              (value) => setSeriesField(i, 'enabled', value && true)
                            "
                          />
                        </u-tooltip>
                      </span>
                      <u-tooltip text="Move Up">
                        <u-button
                          aria-label="Move Up"
                          class="ml-2"
                          :disabled="i === 0"
                          icon="i-lucide-arrow-up"
                          size="6px"
                          variant="flat"
                          @click="moveSeriesUp(i)"
                        />
                      </u-tooltip>
                      <u-tooltip text="Move Down">
                        <u-button
                          aria-label="Move Down"
                          class="ml-2"
                          :disabled="i === state.series.length - 1"
                          icon="i-lucide-arrow-down"
                          size="6px"
                          variant="flat"
                          @click="moveSeriesDown(i)"
                        />
                      </u-tooltip>
                      <u-tooltip text="Remove">
                        <u-button
                          aria-label="Remove"
                          class="ml-2"
                          color="error"
                          icon="i-lucide-trash-2"
                          size="6px"
                          variant="flat"
                          @click="removeSeries(i)"
                        />
                      </u-tooltip>
                    </span>
                  </template>
                  <u-select-menu
                    class="w-full"
                    :content="{}"
                    :items="
                      selectableAssets.map((asset) => ({
                        label:
                          `${asset} (${discrete.assetToStation[asset]})` +
                          `${getNoDataIndicator({ asset }, 'asset')}`,
                        value: asset,
                      }))
                    "
                    label-key="label"
                    :model-value="series.asset"
                    size="sm"
                    value-key="value"
                    @update:model-value="(value: any) => setSeriesField(i, 'asset', value)"
                  >
                    <template #item-label="{ item }">
                      {{ (item as any).label }} {{ itemLabelModifier }}
                    </template>
                  </u-select-menu>
                </u-form-field>
                <u-form-field class="flex-1 min-w-80" label="X-Axis" size="sm">
                  <u-select-menu
                    class="w-full"
                    :items="
                      discrete.plottableFields.map((field) => ({
                        label: `${field} ${getNoDataIndicator(
                          {
                            asset: series.asset,
                            x: field,
                          },
                          'x',
                        )}`,
                        value: field,
                      }))
                    "
                    label-key="label"
                    :model-value="series.x"
                    size="sm"
                    value-key="value"
                    @update:model-value="(value: string) => setSeriesField(i, 'x', value)"
                  >
                    <template #item-label="{ item }">
                      <span
                        :class="
                          isNoData({ asset: series.asset, x: (item as any).value }, 'x')
                            ? 'opacity-75'
                            : ''
                        "
                      >
                        {{ (item as any).value }}
                        {{
                          getNoDataIndicator({ asset: series.asset, x: (item as any).value }, 'x')
                        }}
                        {{ itemLabelModifier }}
                      </span>
                    </template>
                  </u-select-menu>
                </u-form-field>
                <u-form-field class="flex-1 min-w-80" label="Y-Axis" size="sm">
                  <u-select-menu
                    class="w-full"
                    :items="
                      discrete.plottableFields.map((field) => ({
                        label: `${field} ${getNoDataIndicator(
                          {
                            asset: series.asset,
                            y: field,
                          },
                          'y',
                        )}`,
                        value: field,
                      }))
                    "
                    label-key="label"
                    :model-value="series.y"
                    size="sm"
                    value-key="value"
                    @update:model-value="(value: string) => setSeriesField(i, 'y', value)"
                  >
                    <template #item-label="{ item }">
                      <span
                        :class="
                          isNoData({ asset: series.asset, y: (item as any).value }, 'y')
                            ? 'opacity-75'
                            : ''
                        "
                      >
                        {{ (item as any).value }}
                        {{
                          getNoDataIndicator({ asset: series.asset, x: (item as any).value }, 'x')
                        }}
                        {{ itemLabelModifier }}
                      </span>
                    </template>
                  </u-select-menu>
                </u-form-field>
                <div class="flex flex-1 flex-row shrink space-x-2">
                  <u-form-field class="grow min-w-24" label="Year" size="sm">
                    <u-select-menu
                      class="w-full"
                      :items="
                        yearOptions.map((year) => ({
                          label: `${year} ${getNoDataIndicator({ ...series, year }, 'year')}`,
                          value: year,
                        }))
                      "
                      label-key="label"
                      :model-value="series.year"
                      size="sm"
                      value-key="value"
                      @update:model-value="(value: any) => setSeriesField(i, 'year', value)"
                    >
                      <template #item-label="{ item }">
                        <span
                          :class="
                            isNoData({ ...series, year: (item as any).value }, 'year')
                              ? 'opacity-75'
                              : ''
                          "
                        >
                          {{ (item as any).value }}
                          {{ getNoDataIndicator({ ...series, year: (item as any).value }, 'year') }}
                          {{ itemLabelModifier }}
                        </span>
                      </template>
                    </u-select-menu>
                  </u-form-field>
                  <u-form-field class="grow min-w-24" label="Display" size="sm">
                    <u-select
                      class="w-full"
                      :items="
                        ['scatter', 'line'].map((value) => ({
                          label: upperFirst(value),
                          value,
                        }))
                      "
                      :model-value="series.display"
                      size="sm"
                      @update:model-value="(val: any) => setSeriesField(i, 'display', val)"
                    >
                      <template #item-label="{ item }">
                        {{ upperFirst((item as any).label) }} {{ itemLabelModifier }}
                      </template>
                    </u-select>
                  </u-form-field>
                  <u-form-field class="flex-1 min-w-24 mr-2" label="Color" size="sm">
                    <u-input
                      class="w-full"
                      :model-value="series.color"
                      size="sm"
                      type="color"
                      @update:model-value="(value: string) => setSeriesField(i, 'color', value)"
                    />
                    <template #label>
                      <div class="flex flex-row justify-between">
                        <span class="mr-1">Color</span>
                        <u-button
                          class="px-2 rounded-full"
                          icon="i-lucide-dices"
                          :size="5"
                          variant="subtle"
                          @click="setSeriesField(i, 'color', getRandomColor())"
                        />
                      </div>
                    </template>
                  </u-form-field>
                </div>
              </div>
              <u-separator v-if="i < state.series.length - 1" class="my-2" />
            </template>
          </u-card>
          <div class="flex flex-row justify-center mt-3 space-x-2">
            <u-tooltip text="Add">
              <u-button
                class="rounded-full"
                icon="i-lucide-plus"
                size="sm"
                variant="subtle"
                @click="addSeries()"
              />
            </u-tooltip>
            <u-tooltip text="Remove Last">
              <u-button
                class="rounded-full"
                :disabled="state.series.length < 2"
                icon="i-lucide-minus"
                size="sm"
                variant="subtle"
                @click="removeSeries()"
              />
            </u-tooltip>
          </div>
        </div>
        <div class="pt-4">
          <template v-if="option != null">
            <chart ref="chart" class="h-150" :option="option" />
          </template>
          <p v-else-if="series.length === 0" class="text-center text-md">
            No data series to display.
          </p>
        </div>
      </div>
    </u-page-body>
  </u-page>
</template>
