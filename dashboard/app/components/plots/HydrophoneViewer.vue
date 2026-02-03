<script lang="ts" setup>
import { onMounted, watch } from 'vue'

import { useStore } from '@/store'

const { instruments, basePath, } = defineProps<{
  instruments: string[]
  basePath: string
}>()

const currentDate = new Date()
const currentYear = currentDate.getFullYear()
const store = useStore()

const currentDays = $ref<Record<string, number>>({})
const imageExists = $ref<Record<string, boolean>>({})
const imageCache = $ref<Record<string, boolean>>({})
const selectedYear = $ref(currentYear)
const availableYears = $ref(
  Array.from({ length: currentYear - 2014 + 1 }, (_, i) => currentYear - i).sort(),
)
let maxDaysInRange = $ref(calculateMaxDays(currentYear))

const isCurrentYear = $computed(() => selectedYear === new Date().getFullYear())

watch(
  () => currentDays,
  () => {
    for (const instrument of Object.keys(currentDays)) {
      checkImageExists(instrument)
    }
  },
  { deep: true },
)

watch(
  () => selectedYear,
  () => {
    for (const instrument of instruments) {
      checkImageExists(instrument)
    }
  },
)

onMounted(() => {
  for (const instrument of instruments) {
    currentDays[instrument] = maxDaysInRange
    imageExists[instrument] = false
    checkImageExists(instrument)
  }
})

function calculateMaxDays(year: number) {
  const currentYear = new Date().getFullYear()

  if (year === currentYear) {
    // For current year, calculcate days from Jan 1 to yesterday.
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const startOfYear = new Date(year, 0, 1)
    return Math.floor((yesterday.valueOf() - startOfYear.valueOf()) / (1000 * 60 * 60 * 24)) + 1
  }

  // For previous years, calculate days between Jan 1 and Dec 31.
  const startDate = new Date(year, 0, 1)
  const endDate = new Date(year, 11, 31)
  return Math.floor((endDate.valueOf() - startDate.valueOf()) / (1000 * 60 * 60 * 24)) + 1
}

function onYearChange() {
  maxDaysInRange = calculateMaxDays(selectedYear)

  // Reset all instruments to the first day of the selected year
  instruments.forEach((instrument) => {
    currentDays[instrument] = 1
    checkImageExists(instrument)
  })
}
function getStartDate() {
  return new Date(selectedYear, 0, 1) // January 1st of selected year
}

function getEndDate() {
  if (isCurrentYear) {
    // Yesterday for current year
    return new Date(new Date().setDate(new Date().getDate() - 1))
  }

  // December 31st for previous years
  return new Date(selectedYear, 11, 31)
}

function getDayForInstrument(instrument: string) {
  const startDate = new Date(selectedYear, 0, 1)
  const dayOffset = (currentDays[instrument] || 1) - 1
  const resultDate = new Date(startDate)
  resultDate.setDate(startDate.getDate() + dayOffset)
  return resultDate
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatDateForUrl(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function getSpectrogramUrl(instrument: string) {
  const date = getDayForInstrument(instrument)
  const dateStr = formatDateForUrl(date)
  return `${basePath}/${selectedYear}/${instrument}/${instrument}_${dateStr}.png`
}

function checkImageExists(instrument: string) {
  const url = getSpectrogramUrl(instrument)

  // Check cache first.
  const cacheKey = `${instrument}_${url}`
  if (imageCache[cacheKey] !== undefined) {
    imageExists[instrument] = imageCache[cacheKey]
    return
  }

  const img = new Image()

  img.onload = () => {
    imageExists[instrument] = true
    imageCache[cacheKey] = true
  }

  img.onerror = () => {
    imageExists[instrument] = false
    imageCache[cacheKey] = false
  }

  img.src = url
}
</script>

<template>
  <div class="m-0 max-w-300 w-full">
    <!-- Year Selector -->
    <div class="flex flex-row items-center mb-4 space-x-1">
      <label class="font-bold text-md" for="year-select">Select Year:</label>
      <u-select
        id="year-select"
        v-model="selectedYear"
        :items="availableYears"
        @change="onYearChange"
      />
    </div>

    <!-- Instruments -->
    <div
      v-for="instrument in instruments"
      :key="instrument"
      class="border-b border-b-[#eee] last:border-b-transparent mb-10 pb-5 w-full"
    >
      <h3 class="font-bold mb-2.5 text-[#333] text-[1.2rem]">
        {{ instrument }}
      </h3>

      <div v-if="imageExists[instrument]" class="mb-4">
        <img
          alt="Spectrogram"
          class="h-auto w-full"
          :src="getSpectrogramUrl(instrument)"
          style="border: 1px solid #ccc; border-radius: 4px"
        />
      </div>
      <div
        v-else
        class="aspect-2/1 bg-[#f5f5f5] flex items-center justify-center mb-4 rounded-[4px]"
      >
        <p>
          No spectrogram found for {{ instrument }} on
          {{ formatDate(getDayForInstrument(instrument)) }}
        </p>
      </div>

      <!-- Individual slider controls for each instrument -->
      <div class="flex flex-nowrap flex-row items-center space-x-4 text-nowrap">
        <span class="text-xs">{{ formatDate(getStartDate()) }}</span>
        <u-slider
          v-model="currentDays[instrument]"
          class="grow"
          :max="maxDaysInRange"
          :min="1"
          size="sm"
        />
        <span class="text-xs">{{ formatDate(getEndDate()) }}</span>
        <p class="font-bold ml-4 mr-8 text-[16px] text-center w-35">
          {{ formatDate(getDayForInstrument(instrument)) }}
        </p>
      </div>
    </div>
  </div>
</template>
