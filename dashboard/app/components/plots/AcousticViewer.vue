<script lang="ts" setup>
import { CalendarDate, DateFormatter, parseDate, today } from '@internationalized/date'
import { computed, onMounted, watch } from 'vue'

import { acousticImagePath, sensorId } from '~/instruments'
import { usePersisted } from '~/persisted'

const {
  instruments,
  basePath,
  kind = 'Spectrogram',
} = defineProps<{
  /** Full reference designators; image paths use the trailing sensor id. */
  instruments: string[]
  basePath: string
  /** Image type, for labels and alt text. */
  kind?: string
}>()

// Images are published per UTC day, so every date here is a CalendarDate — a
// plain calendar date with no timezone. A local-time Date would land on the
// wrong file for anyone not on UTC.
const FIRST_YEAR = 2014
const MIN_DATE = new CalendarDate(FIRST_YEAR, 1, 1)
// Today's images are not published until the day completes.
const MAX_DATE = today('UTC').subtract({ days: 1 })

const dateFormatter = new DateFormatter('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

function dayOfYear(date: CalendarDate): number {
  const ms = Date.UTC(date.year, date.month - 1, date.day) - Date.UTC(date.year, 0, 1)
  return Math.round(ms / 86_400_000) + 1
}

function dateFromDayOfYear(year: number, day: number): CalendarDate {
  return new CalendarDate(year, 1, 1).add({ days: day - 1 })
}

/** Last selectable day of a year: Dec 31, or the newest published day this year. */
function maxDayOfYear(year: number): number {
  return dayOfYear(year === MAX_DATE.year ? MAX_DATE : new CalendarDate(year, 12, 31))
}

function formatDate(date: CalendarDate): string {
  return dateFormatter.format(date.toDate('UTC'))
}

// Shareable state: ?date=YYYY-MM-DD is the master date every panel starts on.
const persisted = usePersisted({
  schema: ({ object, string }) => object({ date: string().optional() }),
  methods: [{ type: 'url' }],
})

function parsePersistedDate(): CalendarDate {
  if (persisted.date) {
    try {
      return parseDate(persisted.date)
    } catch {
      // malformed ?date= — fall back to the newest published day
    }
  }
  return MAX_DATE
}

let selectedYear = $ref(parsePersistedDate().year)
// Day-of-year per instrument. Each panel keeps its own slider so you can scrub
// one instrument while watching it; the master date resets them all in step.
const currentDays = $ref<Record<string, number>>({})
/** URLs whose <img> actually failed, despite coverage listing the day. */
const loadFailed = $ref<Record<string, boolean>>({})

const availableYears = Array.from(
  { length: MAX_DATE.year - FIRST_YEAR + 1 },
  (_, i) => FIRST_YEAR + i,
)

const maxDaysInRange = $computed(() => maxDayOfYear(selectedYear))

/** Set the master date and move every panel to it. */
function applyToAll(date: CalendarDate) {
  persisted.date = date.toString()
  selectedYear = date.year
  const day = dayOfYear(date)
  for (const instrument of instruments) {
    currentDays[instrument] = day
  }
}

const masterDate = computed<CalendarDate>({
  get: () => parsePersistedDate(),
  set: (value) => applyToAll(value ?? MAX_DATE),
})

/** True once any panel has been scrubbed away from the master date. */
const outOfSync = $computed(() => {
  const day = dayOfYear(masterDate.value)
  return (
    selectedYear !== masterDate.value.year ||
    instruments.some((instrument) => currentDays[instrument] !== day)
  )
})

function dateFor(instrument: string): CalendarDate {
  return dateFromDayOfYear(selectedYear, currentDays[instrument] ?? 1)
}

function getSpectrogramUrl(instrument: string): string {
  const yyyymmdd = dateFor(instrument).toString().replace(/-/g, '')
  return acousticImagePath(basePath, sensorId(instrument), yyyymmdd)
}

function onYearChange() {
  // Keep the day-of-year across the jump rather than snapping back to Jan 1.
  const day = Math.min(dayOfYear(masterDate.value), maxDayOfYear(selectedYear))
  applyToAll(dateFromDayOfYear(selectedYear, day))
}

// ── Coverage ─────────────────────────────────────────────────────────────────
type Coverage = { year: number; images: number[]; raw: number[]; rawKnown: boolean }
const coverage = $ref<Record<string, Coverage>>({})
const rawLoaded = $ref<Record<string, boolean>>({})

const coverageKind = $computed(() => (kind === 'Echogram' ? 'echograms' : 'spectrograms'))

/**
 * Images first so the rail paints immediately, then the raw-archive pass, which
 * costs a request per gap month and only changes how gaps are shaded.
 */
async function loadCoverage(instrument: string, year: number) {
  const key = `${instrument}:${year}`
  const params = { kind: coverageKind, refDes: instrument, year }
  try {
    coverage[key] = await $fetch<Coverage>('/api/acoustic-coverage', { query: params })
    const enriched = await $fetch<Coverage>('/api/acoustic-coverage', {
      query: { ...params, raw: '1' },
    })
    coverage[key] = enriched
    // False for instruments the raw archive does not cover, so their gaps stay
    // "unknown" instead of being reported as genuine outages.
    rawLoaded[key] = enriched.rawKnown
  } catch (error) {
    console.error('Failed to load coverage.', error)
  }
}

function coverageFor(instrument: string) {
  return coverage[`${instrument}:${selectedYear}`]
}

function coverageRawLoaded(instrument: string) {
  return rawLoaded[`${instrument}:${selectedYear}`] === true
}

/** Published days as sets, so panel lookups are O(1) rather than scanning. */
const imageDays = $computed(() => {
  const result: Record<string, Set<number>> = {}
  for (const instrument of instruments) {
    const found = coverage[`${instrument}:${selectedYear}`]
    if (found) result[instrument] = new Set(found.images)
  }
  return result
})

/**
 * Coverage already says which days were published, so a panel never has to
 * request an image to find out whether one exists. 'failed' is reserved for an
 * image that coverage listed but which would not actually load.
 */
function panelState(instrument: string): 'pending' | 'present' | 'absent' | 'failed' {
  const days = imageDays[instrument]
  const day = currentDays[instrument]
  if (!days || day === undefined) return 'pending'
  if (!days.has(day)) return 'absent'
  return loadFailed[getSpectrogramUrl(instrument)] ? 'failed' : 'present'
}

/** Day-of-year to a readable date, for rail tooltips. */
function labelDay(day: number): string {
  return formatDate(dateFromDayOfYear(selectedYear, day))
}

function refreshCoverage() {
  for (const instrument of instruments) {
    if (!coverage[`${instrument}:${selectedYear}`]) void loadCoverage(instrument, selectedYear)
  }
}

watch(() => selectedYear, refreshCoverage)

onMounted(() => {
  applyToAll(parsePersistedDate())
  refreshCoverage()
})
</script>

<template>
  <div class="m-0 max-w-300 w-full">
    <!-- Master controls: set every panel at once -->
    <div class="flex flex-wrap gap-4 items-end mb-6">
      <div class="flex flex-col gap-1">
        <span class="text-gray-500 text-xs">Date (UTC)</span>
        <u-popover>
          <u-button class="w-52" icon="i-lucide-calendar" size="sm" variant="outline">
            {{ formatDate(masterDate) }}
          </u-button>
          <template #content>
            <u-calendar v-model="masterDate" :max-value="MAX_DATE" :min-value="MIN_DATE" />
          </template>
        </u-popover>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-gray-500 text-xs">Year</span>
        <u-select
          id="year-select"
          v-model="selectedYear"
          class="w-28"
          :items="availableYears"
          size="sm"
          @change="onYearChange"
        />
      </div>
      <u-button
        v-if="outOfSync"
        icon="i-lucide-refresh-cw"
        size="sm"
        variant="outline"
        @click="applyToAll(masterDate)"
      >
        Sync all to {{ formatDate(masterDate) }}
      </u-button>
      <p class="max-w-sm ml-auto pb-1 text-gray-500 text-right text-xs">
        Pick a date to move every instrument together, or drag a single slider to cycle through
        days.
      </p>
    </div>

    <!-- Instruments -->
    <div
      v-for="instrument in instruments"
      :key="instrument"
      class="border-b border-b-[#eee] last:border-b-transparent mb-10 pb-5 w-full"
    >
      <h3 class="font-bold font-mono mb-2.5 text-[#333] text-[1.2rem]">
        {{ instrument }}
      </h3>

      <div v-if="panelState(instrument) === 'present'" class="mb-4">
        <img
          :alt="`${kind} for ${instrument} on ${formatDate(dateFor(instrument))} UTC`"
          class="h-auto w-full"
          loading="lazy"
          :src="getSpectrogramUrl(instrument)"
          style="border: 1px solid #ccc; border-radius: 4px"
          @error="loadFailed[getSpectrogramUrl(instrument)] = true"
        />
      </div>
      <!-- Only before coverage arrives is the answer unknown; the fade is delayed
           so a fast coverage fetch never flashes a spinner. -->
      <div
        v-else-if="panelState(instrument) === 'pending'"
        :class="[
          '-delayed aspect-2/1 bg-[#f5f5f5] flex gap-2 items-center justify-center',
          'mb-4 rounded-[4px] text-gray-500',
        ]"
      >
        <u-icon class="animate-spin" name="i-lucide-loader-circle" />
        <p>Loading {{ kind.toLowerCase() }} coverage…</p>
      </div>
      <div
        v-else-if="panelState(instrument) === 'failed'"
        class="aspect-2/1 bg-[#f5f5f5] flex items-center justify-center mb-4 px-4 rounded-[4px]"
      >
        <p>
          {{ kind }} for {{ formatDate(dateFor(instrument)) }} UTC is published but failed to load —
          check your connection.
        </p>
      </div>
      <div
        v-else
        class="aspect-2/1 bg-[#f5f5f5] flex items-center justify-center mb-4 rounded-[4px]"
      >
        <p>
          No {{ kind.toLowerCase() }} found for {{ instrument }} on
          {{ formatDate(dateFor(instrument)) }} UTC
        </p>
      </div>

      <!-- Individual slider controls for each instrument -->
      <div class="flex flex-nowrap flex-row items-center space-x-4 text-nowrap">
        <span class="text-xs">{{ formatDate(dateFromDayOfYear(selectedYear, 1)) }}</span>
        <u-slider
          v-model="currentDays[instrument]"
          :aria-label="`Date for ${instrument}`"
          class="grow"
          :max="maxDaysInRange"
          :min="1"
          size="sm"
        />
        <span class="text-xs">
          {{ formatDate(dateFromDayOfYear(selectedYear, maxDaysInRange)) }}
        </span>
        <p class="font-bold ml-4 mr-8 text-[16px] text-center w-35">
          {{ formatDate(dateFor(instrument)) }}
        </p>
      </div>

      <!-- Aligned to the slider track above: same row insets, so the rail and
           the thumb share an axis. -->
      <div v-if="coverageFor(instrument)" class="flex flex-row items-start space-x-4">
        <span class="invisible text-xs">{{ formatDate(dateFromDayOfYear(selectedYear, 1)) }}</span>
        <coverage-rail
          class="grow"
          :days="maxDaysInRange"
          :images="coverageFor(instrument)!.images"
          :label="labelDay"
          :raw="coverageFor(instrument)!.raw"
          :raw-loaded="coverageRawLoaded(instrument)"
        />
        <span class="invisible text-xs">
          {{ formatDate(dateFromDayOfYear(selectedYear, maxDaysInRange)) }}
        </span>
        <p class="invisible ml-4 mr-8 w-35" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Invisible for 400ms: a probe that resolves first unmounts this unpainted. */
.-delayed {
  animation: delayed-in 120ms ease-out 400ms forwards;
  opacity: 0;
}

@keyframes delayed-in {
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .-delayed {
    animation-duration: 1ms;
  }
}
</style>
