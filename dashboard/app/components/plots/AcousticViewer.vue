<script lang="ts" setup>
import { CalendarDate, DateFormatter, parseDate, today } from '@internationalized/date'
import { useDebounceFn } from '@vueuse/core'
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
// Sliders emit per day crossed, so the image URL follows this debounced copy
// instead of fetching every intermediate date. Slider and label stay live.
const loadDays = $ref<Record<string, number>>({})
const SCRUB_DEBOUNCE_MS = 350

type LoadState = 'loading' | 'loaded' | 'missing'
const loadState = $ref<Record<string, LoadState>>({})
/** Distinguishes first paint from a swap. */
const hasLoadedOnce = $ref<Record<string, boolean>>({})
/** Per-URL memory of what resolved, so revisiting a date doesn't re-show a spinner. */
const imageCache = $ref<Record<string, boolean>>({})

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
    requestDay(instrument, day)
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

/** Date the slider is on right now — updates live while scrubbing. */
function dateFor(instrument: string): CalendarDate {
  return dateFromDayOfYear(selectedYear, currentDays[instrument] ?? 1)
}

/** Date actually being fetched/shown — lags the slider by the scrub debounce. */
function loadedDateFor(instrument: string): CalendarDate {
  return dateFromDayOfYear(selectedYear, loadDays[instrument] ?? currentDays[instrument] ?? 1)
}

function getSpectrogramUrl(instrument: string): string {
  const yyyymmdd = loadedDateFor(instrument).toString().replace(/-/g, '')
  return acousticImagePath(basePath, sensorId(instrument), yyyymmdd)
}

/** True while the slider has moved but the image for that date hasn't been requested yet. */
function isPending(instrument: string): boolean {
  return currentDays[instrument] !== undefined && currentDays[instrument] !== loadDays[instrument]
}

/** Only a swap gets a spinner; a first paint would flash one on every lazy panel. */
function displayState(instrument: string): 'first-load' | 'replacing' | 'loaded' | 'missing' {
  if (isPending(instrument) || loadState[instrument] === 'loading') {
    return hasLoadedOnce[instrument] ? 'replacing' : 'first-load'
  }
  return loadState[instrument] === 'missing' ? 'missing' : 'loaded'
}

function onYearChange() {
  // Keep the day-of-year across the jump rather than snapping back to Jan 1.
  const day = Math.min(dayOfYear(masterDate.value), maxDayOfYear(selectedYear))
  applyToAll(dateFromDayOfYear(selectedYear, day))
}

/** Point an instrument's image at a day. The rendered <img> does the fetching. */
function requestDay(instrument: string, day: number) {
  if (loadDays[instrument] === day) return
  loadDays[instrument] = day
  const cached = imageCache[getSpectrogramUrl(instrument)]
  loadState[instrument] = cached === undefined ? 'loading' : cached ? 'loaded' : 'missing'
}

/** Fetch whatever the sliders currently show. */
function requestVisibleDays() {
  for (const instrument of instruments) {
    const day = currentDays[instrument]
    if (day !== undefined) requestDay(instrument, day)
  }
}

// Only fires once scrubbing settles, so a drag costs one request, not one per day.
const commitScrub = useDebounceFn(requestVisibleDays, SCRUB_DEBOUNCE_MS)

function onImageLoad(instrument: string, url: string) {
  imageCache[url] = true
  // Ignore a late event from a date we've already scrubbed away from.
  if (getSpectrogramUrl(instrument) === url) {
    loadState[instrument] = 'loaded'
    hasLoadedOnce[instrument] = true
  }
}

function onImageError(instrument: string, url: string) {
  imageCache[url] = false
  if (getSpectrogramUrl(instrument) === url) loadState[instrument] = 'missing'
}

watch(() => currentDays, commitScrub, { deep: true })

// applyToAll loads at once; only scrubbing debounces.
onMounted(() => applyToAll(parsePersistedDate()))
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
        Pick a date to move every instrument together, or drag a single slider (arrow keys work once
        focused) to scrub one instrument on its own.
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

      <div
        class="mb-4 min-h-40 relative"
        :class="displayState(instrument) !== 'loaded' ? 'bg-[#f5f5f5] rounded-[4px]' : ''"
      >
        <!-- Never v-if'd: display:none would disable loading="lazy". -->
        <img
          :alt="`${kind} for ${instrument} on ${formatDate(loadedDateFor(instrument))} UTC`"
          class="h-auto w-full"
          :class="{
            'opacity-30': displayState(instrument) === 'replacing',
            invisible:
              displayState(instrument) === 'missing' || displayState(instrument) === 'first-load',
          }"
          loading="lazy"
          :src="getSpectrogramUrl(instrument)"
          style="border: 1px solid #ccc; border-radius: 4px"
          @error="onImageError(instrument, getSpectrogramUrl(instrument))"
          @load="onImageLoad(instrument, getSpectrogramUrl(instrument))"
        />
        <!-- First paint: no spinner. -->
        <div
          v-if="displayState(instrument) === 'first-load'"
          class="absolute flex inset-0 items-center justify-center text-gray-400 text-sm"
        >
          {{ formatDate(loadedDateFor(instrument)) }} UTC
        </div>
        <!-- Swap: spinner, fade-in delayed so quick swaps never flash it. -->
        <div
          v-else-if="displayState(instrument) === 'replacing'"
          :class="[
            '-delayed-spinner absolute flex gap-2 inset-0 items-center justify-center',
            'text-gray-600',
          ]"
        >
          <u-icon class="animate-spin" name="i-lucide-loader-circle" />
          <p>Loading {{ kind.toLowerCase() }} for {{ formatDate(dateFor(instrument)) }} UTC…</p>
        </div>
        <div
          v-else-if="displayState(instrument) === 'missing'"
          class="absolute flex inset-0 items-center justify-center px-4 text-center"
        >
          <p>
            No {{ kind.toLowerCase() }} found for {{ instrument }} on
            {{ formatDate(loadedDateFor(instrument)) }} UTC
          </p>
        </div>
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
    </div>
  </div>
</template>

<style scoped>
/* Invisible for 400ms: a load that finishes first unmounts this unpainted. */
.-delayed-spinner {
  opacity: 0;
  animation: delayed-spinner-in 120ms ease-out 400ms forwards;
}

@keyframes delayed-spinner-in {
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .-delayed-spinner {
    animation-duration: 1ms;
  }
}
</style>
