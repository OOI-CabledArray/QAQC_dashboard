<script lang="ts" setup>
import { useEventListener } from '@vueuse/core'
import type { SeriesOption } from 'echarts'
import {
  cloneDeep,
  compact,
  orderBy,
  truncate,
  uniq,
  uniqBy,
  upperFirst,
  min,
  max,
  range,
  omit,
} from 'lodash-es'
import Zod from 'zod'

import type { Option } from '~/chart'
import type Chart from '~/components/Chart.vue'
import type { Sample, SampleSchemaFieldDefinition, SampleValue } from '~/discrete'
import { useDiscrete } from '~/discrete'
import { usePersisted } from '~/persisted'
import { isMac } from '~/platform'
import { useUndo } from '~/undo'

useHead({
  titleTemplate: 'Discrete Data | %s',
})

const minOf = min
const maxOf = max

// Reference to the `Chart` component instance, used to dispatch actions and listen for events.
const chartInstance = $ref<InstanceType<typeof Chart> | null>(null)

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

// The data only seems to contain values with up to 6 decimal places, so anything beyond that is
// probably just floating-point noise that gives an inaccurate impression of precision that isn't
// there.
const decimalPlacesInTooltip = 6
const decimalPlacesInAxisLabel = 3

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
  // Note that we need to convert these possibly `undefined` values to `null` before passing them to
  // the `model-value` of a NuxtUI select or select menu component because they seem to treat
  // `undefined` as being "no input" instead of an actual value, despite accepting them
  // type-checking wise. This ends up causing weird behavior where the value in the state goes out
  // of sync with the value stored/displayed by the component in some cases.
  asset: Zod.string().optional(),
  x: Zod.string().optional(),
  y: Zod.string().optional(),
  year: Zod.number().optional(),
  display: Zod.enum(['scatter', 'line']).default('scatter'),
  enabled: Zod.boolean().default(true),
  color: Zod.string().default(chartColors[0]),
})

function createDefaultZoom(): ZoomState {
  return {
    x: { start: 0, end: 100 },
    y: { start: 0, end: 100 },
  }
}

// State for the page, stored as query parameters in the URL.
const state = usePersisted({
  schema: Zod.object({
    series: SeriesSchema.array().default(() => [SeriesSchema.parse({})] as any),
    seriesCollapsed: Zod.boolean().default(false).catch(false),
    bounds: Zod.enum(['selected-data', 'all-data', 'from-zero', 'from-zero-x', 'from-zero-y'])
      .default('selected-data')
      .catch('selected-data'),
    zoom: Zod.object({
      x: Zod.object({
        start: Zod.number().default(0),
        end: Zod.number().default(100),
      }),
      y: Zod.object({
        start: Zod.number().default(0),
        end: Zod.number().default(100),
      }),
    })
      .default(createDefaultZoom)
      .catch(createDefaultZoom),
  }),
  methods: [{ type: 'url' }],
})

onMounted(() => {
  const zoom = cloneDeep(state.zoom)
  setZoom(zoom)
  setTimeout(() => {
    setZoom(zoom)
  }, 50)
})

const ctrlKey = isMac ? 'Command' : 'Ctrl'

// Omit `zoom` and any other other unintuitive visual-related changes from undo/redo history.
const historyOmit: ReadonlyArray<keyof typeof state> = ['zoom', 'seriesCollapsed']
// Implement undo/redo for modifying the page's state.
const history = useUndo({
  initial: state,
  onUndo(values) {
    Object.assign(state, omit(values, historyOmit))
  },
  onRedo(values) {
    Object.assign(state, omit(values, historyOmit))
  },
})

// Fields for series which may or may not be completely filled out.
type PartialSeries = (typeof state)['series'][number]
// Fully defined series with included index.
type Series = Required<PartialSeries>
// Fields in series objects used for filtering samples.
type SampleFilter = Pick<PartialSeries, 'asset' | 'x' | 'y' | 'year'>

// Assets that can be selected for plotting.
const selectableAssets = $computed(() => discrete.assets.filter((asset) => asset !== 'PI_REQUEST'))

// All series with filter fields completely filled out.
const series = $computed(
  () =>
    compact(
      state.series.map((series) =>
        series.asset != null && series.x != null && series.y != null && series.year != null
          ? series
          : null,
      ),
    ).map((group, index) => ({
      index,
      ...group,
    })) as Series[],
)

// True if all series share the same X axis value.
const xAxesAreSame = $computed(() => uniq(compact(series.map((series) => series.x))).length <= 1)
// True if all series share the same Y axis value.
const yAxesAreSame = $computed(() => uniq(compact(series.map((series) => series.y))).length <= 1)
// True if all series share the same X and Y axis values.
const allAxesAreSame = $computed(() => xAxesAreSame && yAxesAreSame)

// Cache for `getSamplesFor` below.
const getSamplesForCache: Record<string, Sample[]> = {}

// Return all samples matching the provided filter.
function getSamplesFor(filter: SampleFilter): Sample[] {
  const key = [filter.asset ?? '-', filter.x ?? '-', filter.y ?? '-', filter.year ?? '-'].join('&&')
  const cached = getSamplesForCache[key]
  if (cached != null) {
    return cached
  }

  const samples = discrete.samples.filter(
    (sample) =>
      (filter.asset == null || sample.asset === filter.asset) &&
      (filter.x == null || sample.data[filter.x!] != null) &&
      (filter.y == null || sample.data[filter.y!] != null) &&
      (filter.year == null || sample.timestamp.year === filter.year),
  )

  getSamplesForCache[key] = samples
  return samples
}

// Return `true` if there is at least one data point matching the provided filter.
function hasDataFor(filter: SampleFilter) {
  return getSamplesFor(filter).length > 0
}

function getNoDataIndicator(filter: SampleFilter) {
  return !hasDataFor(filter) ? ' (No Data)' : ''
}

const currentYear = new Date().getFullYear()
// The earliest year we have samples for.
const earliestYear = $computed(
  () => minOf(discrete.samples.map((sample) => sample.timestamp.year)) ?? currentYear - 10,
)
// The latest year we have samples for.
const latestYear = $computed(
  () => maxOf(discrete.samples.map((sample) => sample.timestamp.year)) ?? currentYear,
)
// All years from the earliest year we have samples until the last.
const possibleYears = $computed(() => range(earliestYear, latestYear + 1))

// An ECharts series option with data points and axis labels.
type ChartedSeries = Omit<SeriesOption, 'data'> & {
  // Original series being plotted.
  original: Series

  name: string
  data: [SampleValue, SampleValue][]
  itemStyle?: any
  lineStyle?: any

  // Store axis labels for tooltip rendering.
  xAxisLabel: string
  yAxisLabel: string
}

// Computed ECharts series options with data points.
const chartedSeries = $computed(() => {
  return series.map((series, i) => {
    let data = getSamplesFor(series)
      // Convert samples to [X value, Y value] data points for ECharts.
      .map((sample) => [sample.data[series.x], sample.data[series.y]] as [SampleValue, SampleValue])
      // Shouldn't be necessary because the samples match, but just in case.
      .filter(([x, y]) => x != null && y != null)

    // We need to create unique series names depending on which axes are the same/different.
    let name: string
    if (allAxesAreSame) {
      // All axes are the same, so just specify asset and year.
      name = `${series.asset} (${series.year})`
    } else if (xAxesAreSame) {
      // Only X axes are the same, so specify asset, year and the distinct Y axis.
      name = `${series.asset} (${series.year}) — ${series.y}`
    } else if (yAxesAreSame) {
      // Only Y axes are the same, so specify asset, year and the distinct X axis.
      name = `${series.asset} (${series.year}) — ${series.x}`
    } else {
      // Both axes are the different, so specify asset, year, and both the Y and X axis.
      name = `${series.asset} (${series.year}) — ${series.y} / ${series.x}`
    }

    if (data.length === 0) {
      name += ' (No Data)'
    } else {
      // Order by the X-axis.
      data = orderBy(data, ([x]) => x)
      // Ensure all data points are unique.
      data = uniqBy(data, ([x, y]) => x + '|' + y)
    }

    return {
      original: series,
      id: i,
      name,
      type: series.display,
      emphasis: { focus: 'series' },
      data,
      itemStyle: { color: series.color },
      lineStyle: series.display === 'line' ? { color: series.color } : undefined,
      // Not used by ECharts, stored here for tooltip rendering.
      xAxisLabel: series.x,
      yAxisLabel: series.y,
    } satisfies ChartedSeries
  })
})

// Calculate R-squared value for correlation analysis.
function calculateRSquared(datasets: [SampleValue, SampleValue][][]) {
  const data: [SampleValue, SampleValue][] = datasets.flat()
  if (data.length === 0) {
    return null
  }

  const xValues = data.map(([x]) => x as number)
  const yValues = data.map(([_, y]) => y as number)
  const xMean = xValues.reduce((sum, x) => sum + x, 0) / xValues.length
  const yMean = yValues.reduce((sum, y) => sum + y, 0) / yValues.length

  // Calculate sum of squares.
  let totalSumSquares = 0
  let residualSumSquares = 0
  // Calculate regression line slope and intercept.
  let numerator = 0
  let denominator = 0

  for (let i = 0; i < data.length; i++) {
    const x = xValues[i]!
    const y = yValues[i]!
    numerator += (x - xMean) * (y - yMean)
    denominator += (x - xMean) ** 2
  }
  if (denominator === 0) {
    return null
  }

  const slope = numerator / denominator
  const intercept = yMean - slope * xMean

  // Calculate R-squared.
  for (let i = 0; i < data.length; i++) {
    const x = xValues[i]!
    const y = yValues[i]!
    const yPredicted = slope * x + intercept

    totalSumSquares += (y - yMean) ** 2
    residualSumSquares += (y - yPredicted) ** 2
  }

  if (totalSumSquares === 0) {
    return null
  }

  const rSquared = 1 - residualSumSquares / totalSumSquares
  return Math.max(0, Math.min(1, rSquared)) // Clamp between 0 and 1.
}

// Calculate overall R-squared for all enabled series.
const rSquared = $computed(() =>
  calculateRSquared(
    compact(chartedSeries.map((series) => (series.original.enabled ? series.data : null))),
  ),
)

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
  upperFirst(uniq(compact(series.map((current) => current.x?.replaceAll('_', ' ')))).join(', ')),
)
// Label to display on the Y axis.
const yAxisLabel = $computed(() =>
  upperFirst(uniq(compact(series.map((current) => current.y?.replaceAll('_', ' ')))).join(', ')),
)

function computeDataExtents(selectedOnly: boolean) {
  const series = selectedOnly
    ? chartedSeries.filter((series) => series.original.enabled)
    : chartedSeries

  return {
    x: {
      min: minOf(series.flatMap((series) => series.data.map(([x]) => x))) ?? 0,
      max: maxOf(series.flatMap((series) => series.data.map(([x]) => x))) ?? 1,
    },
    y: {
      min: minOf(series.flatMap((series) => series.data.map(([_, y]) => y))) ?? 0,
      max: maxOf(series.flatMap((series) => series.data.map(([_, y]) => y))) ?? 1,
    },
  }
}

const dataExtents = $computed(() => computeDataExtents(false))
const selectedDataExtents = $computed(() => computeDataExtents(true))

function getAxisMinMax(type: 'x' | 'y') {
  switch (state.bounds) {
    case 'selected-data':
      return {
        min: selectedDataExtents[type].min,
        max: selectedDataExtents[type].max,
      }
    case 'all-data':
      return {
        min: dataExtents[type].min,
        max: dataExtents[type].max,
      }
    case 'from-zero':
      return {
        min: minOf([0, dataExtents[type].min]),
        max: dataExtents[type].max,
      }
    case 'from-zero-x':
      return {
        min: type === 'x' ? minOf([0, dataExtents[type].min]) : dataExtents[type].min,
        max: dataExtents[type].max,
      }
    case 'from-zero-y':
      return {
        min: type === 'y' ? minOf([0, dataExtents[type].min]) : dataExtents[type].min,
        max: dataExtents[type].max,
      }
  }

  return {
    min: dataExtents[type].min,
    max: dataExtents[type].max,
  }
}

const xAxisMinMax = $computed(() => getAxisMinMax('x'))
const yAxisMinMax = $computed(() => getAxisMinMax('y'))

function isInvertedAxis(axis: string) {
  const lower = axis.toLowerCase()
  return lower.includes('depth') || lower.includes('pressure')
}

// Invert the Y axis if depth is selected.
const invertYAxis = $computed(() => series.every((series) => isInvertedAxis(series.y ?? '')))

// Shown alongside select labels to show there is a modifier currently being applied.
const itemLabelModifier = $computed(() => {
  let modifier = ''
  if (isApplyingToAll) {
    modifier = '*'
  } else if (isCloningWithChange) {
    modifier = '+'
  }

  return modifier
})

// ECharts `Option` value rendered by the `Chart` component.
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
      left: '0',
      right: '32px',
      bottom: '140px',
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
              ${series.yAxisLabel}: <b>${formatValue(y, decimalPlacesInTooltip)}</b><br/>
              ${series.xAxisLabel}: <b>${formatValue(x, decimalPlacesInTooltip)}</b><br/>
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
      min: xAxisMinMax.min as any,
      max: xAxisMinMax.max as any,
      nameLocation: 'middle',
      nameTextStyle: {
        align: 'center',
      },
      axisLabel:
        xAxisType === 'value'
          ? { formatter: (value: unknown) => formatValue(value, decimalPlacesInAxisLabel) }
          : undefined,
    },
    yAxis: {
      name: yAxisLabel,
      scale: true,
      type: yAxisType,
      min: yAxisMinMax.min as any,
      max: yAxisMinMax.max as any,
      inverse: invertYAxis,
      nameLocation: invertYAxis ? 'start' : 'end',
      axisLabel:
        yAxisType === 'value'
          ? { formatter: (value: unknown) => formatValue(value, decimalPlacesInAxisLabel) }
          : undefined,
    },
    dataZoom: [
      {
        id: 'x-inside',
        type: 'inside',
        xAxisIndex: 0,
        moveOnMouseWheel: 'alt',
        disabled: isShiftPressed,
      },
      {
        id: 'y-inside',
        type: 'inside',
        yAxisIndex: 0,
        disabled: isCtrlPressed,
      },
      {
        id: 'x-slider',
        type: 'slider',
        bottom: 80,
        height: 22,
        showDetail: false,
        showDataShadow: false,
      },
      {
        id: 'y-slider',
        type: 'slider',
        yAxisIndex: 0,
        width: 22,
        top: 24,
        right: 4,
        showDetail: false,
        showDataShadow: false,
      },
    ],
    legend: {
      selected: Object.fromEntries(
        chartedSeries.map((current) => [current.name, current.original.enabled]),
      ),
      show: chartedSeries.length <= 20,
      bottom: 0,
    },
    series: chartedSeries as any,
  } satisfies Option
})

// Add a new series at the given index, or at the end if no index is provided. If `copy` is
// provided, the new series will be created with the same values as that series, with any overrides
// from `changes` applied on top. If `copy` is not provided, the last series in the list will be
// copied instead. The added series will have a `color` automatically assigned.
function addSeries({
  index,
  copy,
  changes,
  saveUndo = true,
}: {
  index?: number
  copy?: Readonly<PartialSeries>
  changes?: Record<string, any>
  saveUndo?: boolean
} = {}) {
  if (index == null) {
    index = state.series.length
  }
  if (copy == null) {
    copy = state.series[index - 1]
  }

  // Generate a color for the new series, trying to use a pre-defined color if possible, but
  // ensuring it is unique from all existing series colors.
  let color = chartColors[state.series.length] ?? getRandomColor()
  let attempts = 0
  while (attempts < 10 && state.series.some((series) => series.color === color)) {
    color = getRandomColor()
    attempts += 1
  }

  const created = SeriesSchema.parse({
    ...cloneDeep(copy ?? {}),
    color,
    ...changes,
  })

  state.series.splice(index, 0, created)
  if (saveUndo) {
    history.save(state)
  }

  return created
}

// Remove the series at the given index, or the last series if no index is provided. Returns the
// removed series, or `null` if no series was found to remove.
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

// Move the series at the given index up one position, if possible.
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

// Move the series at the given index down one position, if possible.
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

// If `true` any changes to a data series will be applied to all series.
const isApplyingToAll = $computed(() => isShiftPressed)
// If `true` any changes to a data series will instead create a new series with that change.
const isCloningWithChange = $computed(() => isCtrlPressed)
// Creating a new series by clicking a the checkbox or item in the legend seems like a bad idea.
const cloneWithChangeIgnore: (keyof PartialSeries)[] = ['enabled']

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

// Return a new series object with the provided `field` set to `value` while keeping the order
// of fields consistent with the `SeriesSchema` definition. The reason being: the JSON of each
// series object is displayed in the browser's URL, and having a consistent order with `asset`
// displayed first makes the URL more readable. In addition, when opening a shared link to this
// page, the URL won't appear to suddenly change when the data is re-parsed from the URL on load
// anyway.
function withSeriesFieldSet(series: PartialSeries, field: keyof PartialSeries, value: any) {
  const data = { ...series, [field]: value }
  try {
    // Re-parse the object so fields are in the correct order.
    return SeriesSchema.parse(data)
  } catch {
    // In the unlikely case re-parsing fails, just return the object without re-ordering.
    return data
  }
}

// Handler for when a field on a data series at a given index is changed by the user. The behavior
// of this changes depending on which modifier keys are held.
function setSeriesField<K extends keyof PartialSeries>(
  index: number,
  field: K,
  value: PartialSeries[K] | null | undefined,
  { saveUndo = true }: { saveUndo?: boolean } = {},
) {
  // Convert `null` to `undefined` for consistency.
  if (value == null) {
    value = undefined
  }

  // The series (possibly) being modified.
  const series = state.series[index]
  if (series == null) {
    return
  }

  if (isCloningWithChange && !cloneWithChangeIgnore.includes(field)) {
    // Create an identical series below with the changed value set.
    addSeries({ index: index + 1, copy: series, changes: { [field]: value }, saveUndo })
  } else if (isApplyingToAll) {
    // Apply the change to all series.
    state.series = state.series.map((current) => withSeriesFieldSet(current, field, value))
    if (saveUndo) {
      history.save(state)
    }
  } else {
    // Apply the change to just the current series.
    state.series[index] = withSeriesFieldSet(series, field, value)
    if (saveUndo) {
      history.save(state)
    }
  }
}

function duplicateSeries(index: number) {
  const series = state.series[index]
  if (series == null) {
    return
  }

  return addSeries({
    index: index + 1,
    copy: series,
  })
}

// Create series with the same (`asset`, `x`, `y`) of the given series at `index` for all years. If
// `withMatchingData` is `true`, do this only for years for which we have data matching the original
// series' filter fields. All generated series objects will be inserted after `index`, and the
// series currently at `index` will be moved to its sorted position in the generated list, provided
// it already had its `year` set, otherwise it will be assigned the first year available.
function duplicateSeriesForAllYears(
  index: number,
  { withMatchingData = true }: { withMatchingData?: boolean } = {},
) {
  // The series being cloned.
  const series = state.series[index]
  if (series == null) {
    return
  }
  // All years for which we have data matching the series' current `asset`, `x`, and `y` values.
  const yearsToGenerate = withMatchingData
    ? possibleYears.filter((current) => hasDataFor({ ...series, year: current }))
    : possibleYears
  if (yearsToGenerate.length === 0) {
    return
  }

  // If the year of the cloned series isn't already in the list, add it.
  if (series.year != null && !yearsToGenerate.includes(series.year)) {
    yearsToGenerate.push(series.year)
  }

  // Ensure years are sorted.
  yearsToGenerate.sort()
  // Remove the original series.
  state.series.splice(index, 1)

  // Generate a series for each year, copying all other values from the original. Colors are
  // automatically assigned to each one.
  const clones: PartialSeries[] = []
  for (const [i, year] of yearsToGenerate.entries()) {
    clones.push(
      addSeries({
        index: index + i,
        copy: series,
        changes: { year },
        saveUndo: false, // Don't save undo state until we're done.
      }),
    )
  }

  // "Move" the original series it to the correct position in the output. If no `year` was defined
  // on it, it'll be first.
  const clonedOriginalIndex = series.year != null ? yearsToGenerate.indexOf(series.year) : 0
  // The only thing distinguishing the "original series" is the color, so just copy that over.
  const clonedOriginal = clones[clonedOriginalIndex]!
  clonedOriginal.color = series.color

  // Save undo history.
  history.save(state)
  return clones
}

// Create series with the same (`x`, `y`, `year`) of the given series at `index` for all assets. If
// `withMatchingData` is `true`, do this only for assets for which we have data for matching
// the original series' filter fields. All generated series objects will be inserted after `index`.
function duplicateSeriesForAllAssets(
  index: number,
  { withMatchingData = true }: { withMatchingData?: boolean } = {},
) {
  // The series being cloned.
  const series = state.series[index]
  if (series == null) {
    return
  }

  let assetsToGenerate = withMatchingData
    ? // All assets for which we have data matching the series' `x`, `y`, and `year`.
      selectableAssets.filter((current) => hasDataFor({ ...series, asset: current }))
    : selectableAssets

  if (series.asset != null) {
    // If the original series has an `asset` set and it's in the list, we don't need to generate it.
    assetsToGenerate = assetsToGenerate.filter((asset) => asset !== series.asset)
  } else {
    // Otherwise assign the first asset to the original series, and skip generating it.
    series.asset = assetsToGenerate[0]
    assetsToGenerate = assetsToGenerate.slice(1)
  }

  if (assetsToGenerate.length === 0) {
    return
  }

  // Add cloned series for each asset, copying all other values from the original series. Colors are
  // automatically assigned to each one.
  const clones: PartialSeries[] = []
  for (const [i, asset] of assetsToGenerate.entries()) {
    clones.push(
      addSeries({
        index: index + i + 1,
        copy: series,
        changes: { asset },
        saveUndo: false, // Don't save undo state until we're done.
      }),
    )
  }

  // Save undo history.
  history.save(state)
  return clones
}

// Zoom levels for a single axis, stored as percentages from 0 to 100.
type ZoomValue = {
  start: number
  end: number
}

// Zoom levels for the X and Y axes, stored as percentages from 0 to 100.
type ZoomState = {
  x: ZoomValue
  y: ZoomValue
}

// Indicates whether the user has zoomed in on either axis.
const isZoomedIn = $computed(
  () =>
    state.zoom.x.start !== 0 ||
    state.zoom.x.end !== 100 ||
    state.zoom.y.start !== 0 ||
    state.zoom.y.end !== 100,
)

// Register and unregister chart event listeners.
watchEffect((onInvalidate) => {
  const dataZoomEventName = 'dataZoom'
  chartInstance?.on(dataZoomEventName, (event: any) => {
    const batch = event.batch ?? [event]
    for (const event of batch) {
      if (event.dataZoomId == null) {
        continue
      }

      // Check the ID to see if the zoom event was on the X or Y axis.
      const isXAxis = event.dataZoomId.includes('x')
      // Update the stored zoom state.
      const affected = isXAxis ? state.zoom.x : state.zoom.y
      affected.start = event.start
      affected.end = event.end
    }
  })

  // Keep the the series `enabled` states synced with the selected legend items of the chart.
  const legendSelectChangedEventName = 'legendselectchanged'
  chartInstance?.on(legendSelectChangedEventName, (event: any) => {
    const selected: Record<string, boolean> | undefined = event.selected
    if (selected == null) {
      return
    }

    const currentSelectedStates = Object.values(selected)
    const previousSelectedStates = state.series.map((series) => series.enabled)

    console.debug('Series selection changed from legend.', selected)
    for (const [i, isSelected] of currentSelectedStates.entries()) {
      const previousIsSelected = previousSelectedStates[i]
      if (isSelected !== previousIsSelected) {
        setSeriesField(i, 'enabled', isSelected)
        return
      }
    }

    for (const [i, isSelected] of Object.values(selected).entries()) {
      const series = state.series[i]
      if (series != null) {
        series.enabled = isSelected
      }
    }

    history.save(state)
  })

  // Unregister event handlers when invalidated.
  onInvalidate(() => {
    chartInstance?.off(dataZoomEventName)
    chartInstance?.off(dataZoomEventName)
  })
})

// Dispatch actions to change the chart's zoom level and update our stored zoom state to match.
function setZoom(zoom: ZoomState) {
  for (const index of [0, 1]) {
    chartInstance?.dispatchAction({
      type: 'dataZoom',
      dataZoomIndex: index,
      start: zoom.x.start,
      end: zoom.x.end,
    })
  }
  chartInstance?.dispatchAction({
    type: 'dataZoom',
    dataZoomIndex: 2,
    start: zoom.y.start,
    end: zoom.y.end,
  })

  state.zoom = cloneDeep(zoom)
}

// Zoom out completely.
function resetZoom() {
  setZoom(createDefaultZoom())
}

// Format a value for display in an axis label or tooltip.
function formatValue(value: unknown, maxDecimalPlaces: number) {
  // The value should almost always be a number, but just in case, only try to format decimal
  // places if it is.
  if (typeof value === 'number') {
    // Format to fixed number of decimal places, then remove trailing zeros by converting the text
    // back to a number.
    value = Number(value.toFixed(maxDecimalPlaces))
  }

  return String(value)
}

// Link and title to share when the user clicks the share button or copies the URL to their
// clipboard.
const shared = $computed(() => {
  let title = document.title
  const hasAssets = compact(series.map((series) => series.asset)).length > 0
  if (hasAssets) {
    title += `: ${yAxisLabel} vs ${xAxisLabel}`
  }

  title = truncate(title, { length: 120 })

  let url = location.href
  try {
    // Make the URL more human-readable by un-escaping JSON characters stored in query parameters.
    url = decodeURI(url)
  } catch {
    // Ignore decoding errors.
  }

  return { title, url } satisfies ShareData
})

// This will be `true` if the current browser supports the Web Share API and the data we want to
// share is valid.
const canShare = $computed(() => {
  try {
    return navigator.canShare(shared)
  } catch {
    return false
  }
})

const toast = useToast()

// Use the Web Share API to share the page URL, if possible.
async function share() {
  if (!canShare) {
    return false
  }

  const data = { ...shared }
  try {
    await navigator.share(data)
    console.log('Plot link shared.', data)
    return true
  } catch {
    console.log('Share was cancelled or failed.', data)
    return false
  }
}

// Copy the page URL to the user's clipboard.
async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(shared.url)
    toast.add({
      title: 'Plot Link Copied to Clipboard',
      description: 'Share it, so others can view the same data.',
      color: 'success',
    })
    return true
  } catch {
    return false
  }
}
</script>

<template>
  <u-page>
    <u-page-body class="mb-24 px-8 space-y-4">
      <u-page-header title="Discrete Data" />
      <div>
        <div class="flex items-center mb-2 space-x-2">
          <u-tooltip text="Show/Hide Data Series">
            <u-button
              class="px-4"
              color="primary"
              :disable="chartedSeries.length === 0"
              size="xs"
              variant="subtle"
              @click="state.seriesCollapsed = !state.seriesCollapsed"
            >
              Data Series
              {{ state.series.length > 0 ? `(${state.series.length})` : '' }}
              <u-icon
                :name="state.seriesCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
                :size="14"
              />
            </u-button>
          </u-tooltip>
          <u-popover>
            <u-button
              class="cursor-pointer p-1 px-2 rounded-full"
              icon="i-lucide-help-circle"
              label="Tips"
              size="xs"
              variant="subtle"
            />
            <template #content>
              <ul class="max-w-120 p-4 space-y-2 text-sm">
                <li>
                  Use the <b>+</b> and <b>−</b> buttons to add or remove data series to the plot.
                </li>
                <li>
                  You can use <b>{{ ctrlKey }}-Z</b> and <b>{{ ctrlKey }}-Shift-Z</b> (or the
                  dedicated buttons to the right) to undo/redo any changes as needed.
                </li>
                <li>
                  Holding <b>Shift</b> while changing setting a field on a series will apply that
                  same change to <i>all series</i>.
                </li>
                <li>
                  Holding <b>{{ ctrlKey }}</b> while changing a field on series will instead create
                  a <i>new</i> series with that change applied, leaving the original intact. This is
                  handy for quickly adding the next year, for example, or quickly plotting the same
                  data for a different asset.
                </li>
                <li>
                  The "<b>...</b>" menu on each series contains helpful actions for common use
                  cases, such as plotting data for all years of an asset, and vice-versa.
                </li>
                <li>
                  You can use your mouse's scroll wheel to zoom in and out on the chart. Holding
                  <b>Shift</b> while doing so will lock zoom to the Y axis, and <b>{{ ctrlKey }}</b>
                  will lock it to the X.
                </li>
              </ul>
            </template>
          </u-popover>
          <div class="grow" />
          <u-tooltip text="Share Link">
            <u-button
              class="cursor-pointer p-1"
              :disabled="!canShare"
              icon="i-lucide-share"
              size="xs"
              variant="subtle"
              @click="share()"
            />
          </u-tooltip>
          <u-tooltip text="Copy Link to Clipboard">
            <u-button
              class="cursor-pointer p-1"
              icon="i-lucide-copy"
              size="xs"
              variant="subtle"
              @click="copyToClipboard()"
            />
          </u-tooltip>
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
          <u-tooltip text="Remove All Series">
            <u-button
              class="hover:text-error"
              color="error"
              :disabled="state.series.length === 0"
              icon="i-lucide-trash"
              label="*"
              size="xs"
              variant="subtle"
              @click="
                () => {
                  state.series = []
                  history.save(state)
                }
              "
            />
          </u-tooltip>
        </div>
        <div v-if="!state.seriesCollapsed" class="space-y-1">
          <u-card variant="subtle">
            <div v-if="state.series.length === 0" class="p-4 rounded text-center text-sm">
              <u-button
                class="rounded-full"
                color="primary"
                icon="i-lucide-plus"
                size="sm"
                variant="subtle"
                @click="addSeries()"
              />
            </div>
            <template v-for="(series, i) of state.series" :key="i">
              <div
                :class="[
                  'flex flex-column flex-wrap space-x-2 space-y-1 w-full',
                  !series.enabled && 'opacity-80',
                ]"
              >
                <u-form-field class="min-[1700px]:flex-1 min-w-90 relative w-full" size="sm">
                  <template #label>
                    <div class="flex flex-row items-center w-full">
                      <div class="cursor-pointer flex items-center">
                        <div>Asset</div>
                        <u-tooltip text="Toggle Shown">
                          <u-checkbox
                            class="ml-2"
                            :model-value="series.enabled"
                            size="xs"
                            @update:model-value="
                              (value) => setSeriesField(i, 'enabled', value && true)
                            "
                          />
                        </u-tooltip>
                      </div>
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
                      <div class="flex-1 grow" />
                      <u-dropdown-menu
                        :items="[
                          {
                            icon: 'i-lucide-copy-plus',
                            label: 'Duplicate',
                            onSelect: () => duplicateSeries(i),
                          },
                          { type: 'separator' },
                          {
                            icon: 'i-lucide-square-stack',
                            label: `Duplicate For All Years (${possibleYears.length})`,
                            onSelect: () =>
                              duplicateSeriesForAllYears(i, { withMatchingData: false }),
                          },
                          {
                            icon: 'i-lucide-square-stack',
                            label:
                              'Duplicate For All Years With Matching Data (' +
                              uniq(
                                getSamplesFor(omit(series, ['year'])).map(
                                  (current) => current.timestamp.year,
                                ),
                              ).length +
                              ')',
                            onSelect: () =>
                              duplicateSeriesForAllYears(i, { withMatchingData: true }),
                          },
                          { type: 'separator' },
                          {
                            icon: 'i-lucide-square-stack',
                            label: `Duplicate For All Assets (${discrete.assets.length})`,
                            onSelect: () =>
                              duplicateSeriesForAllAssets(i, { withMatchingData: false }),
                          },
                          {
                            icon: 'i-lucide-square-stack',
                            label:
                              'Duplicate For All Assets With Matching Data (' +
                              uniq(
                                getSamplesFor(omit(series, ['asset'])).map(
                                  (current) => current.asset,
                                ),
                              ).length +
                              ')',
                            onSelect: () =>
                              duplicateSeriesForAllAssets(i, { withMatchingData: true }),
                          },
                        ]"
                        size="sm"
                      >
                        <u-button
                          aria-label="More"
                          class="ml-2 p-px"
                          icon="i-lucide-ellipsis"
                          size="10px"
                          variant="flat"
                        />
                      </u-dropdown-menu>
                    </div>
                  </template>
                  <u-select-menu
                    class="w-full"
                    :items="[
                      ...selectableAssets.map((asset) => ({
                        label:
                          `${asset} (${discrete.assetToStation[asset]})` +
                          `${getNoDataIndicator({ asset })}`,
                        value: asset as string | null,
                      })),
                    ]"
                    label-key="label"
                    :model-value="series.asset ?? null"
                    size="sm"
                    value-key="value"
                    @update:model-value="(value) => setSeriesField(i, 'asset', value)"
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
                        label: `${field} ${getNoDataIndicator({ asset: series.asset, x: field })}`,
                        value: field as string | null,
                      }))
                    "
                    label-key="label"
                    :model-value="series.x ?? null"
                    size="sm"
                    value-key="value"
                    @update:model-value="(value) => setSeriesField(i, 'x', value)"
                  >
                    <template #item-label="{ item }">
                      <span
                        :class="
                          !hasDataFor({ asset: series.asset, x: (item as any).value }) &&
                          'opacity-75'
                        "
                      >
                        {{ (item as any).value }}
                        {{ getNoDataIndicator({ asset: series.asset, x: (item as any).value }) }}
                        {{ itemLabelModifier }}
                      </span>
                    </template>
                  </u-select-menu>
                  <u-tooltip text="Swap X and Y">
                    <u-button
                      class="-top-3 -translate-y-1/2 absolute not-hover:opacity-50 right-3 z-10"
                      color="primary"
                      icon="i-lucide-arrow-left-right"
                      size="10px"
                      variant="flat"
                      @click="
                        () => {
                          const { x, y } = series
                          setSeriesField(i, 'x', y, { saveUndo: false })
                          setSeriesField(i, 'y', x)
                        }
                      "
                    />
                  </u-tooltip>
                </u-form-field>
                <u-form-field class="flex-1 min-w-80" label="Y-Axis" size="sm">
                  <u-select-menu
                    class="w-full"
                    :items="
                      discrete.plottableFields.map((field) => ({
                        label: `${field} ${getNoDataIndicator({ asset: series.asset, y: field })}`,
                        value: field ?? null,
                      }))
                    "
                    label-key="label"
                    :model-value="series.y"
                    size="sm"
                    value-key="value"
                    @update:model-value="(value) => setSeriesField(i, 'y', value)"
                  >
                    <template #item-label="{ item }">
                      <span
                        :class="
                          !hasDataFor({ asset: series.asset, y: (item as any).value }) &&
                          'opacity-75'
                        "
                      >
                        {{ (item as any).value }}
                        {{ getNoDataIndicator({ asset: series.asset, x: (item as any).value }) }}
                        {{ itemLabelModifier }}
                      </span>
                    </template>
                  </u-select-menu>
                </u-form-field>
                <div class="flex flex-1 flex-row shrink space-x-2">
                  <u-form-field class="basis-0 grow min-w-34" label="Year" size="sm">
                    <u-select-menu
                      :key="series.year"
                      class="w-full"
                      :items="
                        possibleYears.map((year) => ({
                          label: `${year}${getNoDataIndicator({ ...series, year })}`,
                          value: year as number | null,
                        }))
                      "
                      label-key="label"
                      :model-value="series.year ?? null"
                      size="sm"
                      value-key="value"
                      @update:model-value="(value: any) => setSeriesField(i, 'year', value)"
                    >
                      <template #item-label="{ item }">
                        <span
                          :class="
                            !hasDataFor({ ...series, year: (item as any).value }) && 'opacity-75'
                          "
                        >
                          {{ (item as any).value }}
                          {{ getNoDataIndicator({ ...series, year: (item as any).value }) }}
                          {{ itemLabelModifier }}
                        </span>
                      </template>
                    </u-select-menu>
                  </u-form-field>
                  <u-form-field class="basis-0 grow min-w-24" label="Display" size="sm">
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
                  <u-form-field class="basis-0 flex-1 min-w-24 mr-2" label="Color" size="sm">
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
          <div v-if="state.series.length > 0" class="flex flex-row justify-center mt-3 space-x-2">
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
                :disabled="state.series.length === 0"
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
            <div class="relative">
              <chart ref="chartInstance" class="h-150" :option="option" />
              <div class="-bottom-12 absolute flex justify-center left-0 right-0 space-x-2">
                <u-form-field class="flex items-center" size="sm">
                  <template #label><div class="pt-1 text-xs">Bounds =</div></template>
                  <u-select
                    v-model="state.bounds"
                    class="min-w-50 ml-1"
                    :items="[
                      { label: 'Selected Data Min/Max', value: 'selected-data' },
                      { label: 'Data Min/Max', value: 'all-data' },
                      { label: 'From Zero', value: 'from-zero' },
                      { label: 'From Zero (X)', value: 'from-zero-x' },
                      { label: 'From Zero (Y)', value: 'from-zero-y' },
                    ]"
                    size="sm"
                    @update:model-value="history.save(state)"
                  />
                </u-form-field>
                <u-button
                  class="h-7 mt-1"
                  color="primary"
                  :disabled="!isZoomedIn"
                  icon="i-lucide-zoom-out"
                  label="Reset"
                  size="xs"
                  variant="subtle"
                  @click="resetZoom"
                />
              </div>
              <u-tooltip text="The R-squared value for all currently selected data.">
                <div v-if="rSquared != null" class="mt-3 text-[14px] text-center">
                  <span class="mr-1 relative">
                    R
                    <span class="-right-0.5 -top-0.5 absolute text-[10px]">2</span>
                  </span>
                  = {{ formatValue(rSquared, 6) }}
                </div>
              </u-tooltip>
            </div>
          </template>
          <p v-else-if="state.series.length > 0" class="opacity-80 text-center text-sm">
            Enter the asset, X/Y axis and year of data to plot.
          </p>
        </div>
      </div>
    </u-page-body>
  </u-page>
</template>
