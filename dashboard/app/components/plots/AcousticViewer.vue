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
const imageExists = $ref<Record<string, boolean>>({})
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

function checkImageExists(instrument: string) {
  const url = getSpectrogramUrl(instrument)

  if (imageCache[url] !== undefined) {
    imageExists[instrument] = imageCache[url]
    return
  }

  const img = new Image()
  img.onload = () => {
    imageExists[instrument] = true
    imageCache[url] = true
  }
  img.onerror = () => {
    imageExists[instrument] = false
    imageCache[url] = false
  }
  img.src = url
}

watch(
  () => currentDays,
  () => {
    for (const instrument of Object.keys(currentDays)) {
      checkImageExists(instrument)
    }
  },
  { deep: true },
)

onMounted(() => {
  applyToAll(parsePersistedDate())
  for (const instrument of instruments) {
    imageExists[instrument] = false
    checkImageExists(instrument)
  }
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

      <div v-if="imageExists[instrument]" class="mb-4">
        <img
          :alt="`${kind} for ${instrument} on ${formatDate(dateFor(instrument))} UTC`"
          class="h-auto w-full"
          loading="lazy"
          :src="getSpectrogramUrl(instrument)"
          style="border: 1px solid #ccc; border-radius: 4px"
        />
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
    </div>
  </div>
</template>
