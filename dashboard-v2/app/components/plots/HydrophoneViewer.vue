<script lang="ts" setup>
import { onMounted, watch } from 'vue'

import { useStore } from '@/store'

const {
  instruments = [
    'HYDBBA102',
    'HYDBBA105',
    'HYDBBA106',
    'HYDBBA302',
    'HYDBBA103',
    'HYDBBA303',
    'HYDLFA101',
    'HYDLFA104',
    'HYDLFA301',
    'HYDLFA304',
    'HYDLFA305',
    // 'HYDBBA303',
  ],
} = defineProps<{
  instruments?: string[]
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
  return `${store.spectrogramsURL}/${selectedYear}/${instrument}/${instrument}_${dateStr}.png`
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
  <div class="spectrograms-container">
    <!-- Year selector dropdown -->
    <div class="year-selector">
      <label for="year-select">Select Year:</label>
      <select id="year-select" v-model="selectedYear" class="year-dropdown" @change="onYearChange">
        <option v-for="year in availableYears" :key="year" :value="year">
          {{ year }}
        </option>
      </select>
    </div>

    <!-- Loop through each instrument -->
    <div v-for="instrument in instruments" :key="instrument" class="instrument-container">
      <h3 class="instrument-title">
        {{ instrument }}
      </h3>

      <div v-if="imageExists[instrument]" class="spectrogram-display">
        <img alt="Spectrogram" :src="getSpectrogramUrl(instrument)" />
      </div>
      <div v-else class="no-data-message">
        <p>
          No spectrogram found for {{ instrument }} on
          {{ formatDate(getDayForInstrument(instrument)) }}
        </p>
      </div>

      <!-- Individual slider controls for each instrument -->
      <div class="slider-controls">
        <span>{{ formatDate(getStartDate()) }}</span>
        <input
          v-model.number="currentDays[instrument]"
          class="date-slider"
          :max="maxDaysInRange"
          :min="1"
          type="range"
        />
        <span>{{ formatDate(getEndDate()) }}</span>
        <p class="date-display">
          {{ formatDate(getDayForInstrument(instrument)) }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spectrograms-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1200px;
  margin: 0;
}

.year-selector {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.year-dropdown {
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 1rem;
}

.instrument-container {
  margin-bottom: 40px;
  width: 100%;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.instrument-container:last-child {
  border-bottom: none;
}

.instrument-title {
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 10px;
  color: #333;
}

.spectrogram-display {
  width: 100%;
  margin-bottom: 15px;
}

.spectrogram-display img {
  width: 100%;
  height: auto;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.date-display {
  text-align: center;
  font-weight: bold;
  font-size: 0.9rem;
  margin-top: 5px;
  margin-bottom: 0;
  width: 140px;
}

.no-data-message {
  aspect-ratio: 2/1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  width: 100%;
  border-radius: 4px;
  margin-bottom: 15px;
}

.slider-controls {
  width: 100%;
  font-size: 0.7rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.date-slider {
  flex-grow: 1;
}
</style>
