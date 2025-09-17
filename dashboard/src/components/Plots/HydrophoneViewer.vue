<template>
    <div class="spectrograms-container">
      <!-- Year selector dropdown -->
      <div class="year-selector">
        <label for="year-select">Select Year:</label>
        <select
          id="year-select"
          v-model="selectedYear"
          @change="handleYearChange"
          class="year-dropdown"
        >
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>

      <!-- Loop through each instrument -->
      <div v-for="instrument in instruments" :key="instrument" class="instrument-container">
        <h3 class="instrument-title">{{ instrument }}</h3>

        <div v-if="imageExists[instrument]" class="spectrogram-display">
          <img :src="getSpectrogramUrl(instrument)" alt="Spectrogram" />
        </div>
        <div v-else class="no-data-message">
          <p>No spectrogram found for {{ instrument }} on
            {{ formatDate(getDayForInstrument(instrument)) }}</p>
        </div>

        <!-- Individual slider controls for each instrument -->
        <div class="slider-controls">
          <span>{{ formatDate(getStartDate()) }}</span>
          <input
            type="range"
            :min="1"
            :max="maxDaysInRange"
            v-model.number="currentDays[instrument]"
            class="date-slider"
          />
          <span>{{ formatDate(getEndDate()) }}</span>
          <p class="date-display">{{ formatDate(getDayForInstrument(instrument)) }}</p>
        </div>
      </div>
    </div>
  </template>

<script>
import { mapState } from 'vuex';

export default {
  props: {
    instruments: {
      type: Array,
      default: () => ['HYDBBA102', 'HYDBBA105', 'HYDBBA106', 'HYDBBA302', 'HYDBBA103', 'HYDBBA303', 'HYDLFA101', 'HYDLFA104', 'HYDLFA301', 'HYDLFA304', 'HYDLFA305'], // 'HYDBBA303'
    },
  },
  data() {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();

    return {
      currentDays: {},
      imageExists: {},
      imageCache: {}, // Cache structure: { instrumentId_url: boolean }
      selectedYear: currentYear,
      availableYears: Array.from({ length: currentYear - 2014 + 1 },
        (_, i) => currentYear - i).sort(),
      maxDaysInRange: this.calculateMaxDays(currentYear),
      today: currentDate,
      yesterday: new Date(currentDate.setDate(currentDate.getDate() - 1)),
    };
  },
  computed: {
    ...mapState(['spectrogramsURL']),
    isCurrentYear() {
      return this.selectedYear === new Date().getFullYear();
    },
  },
  methods: {
    calculateMaxDays(year) {
      const currentYear = new Date().getFullYear();

      if (year === currentYear) {
        // For current year: days from Jan 1 to yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfYear = new Date(year, 0, 1);
        return Math.floor((yesterday - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
      }
      // For previous years: Calculate days between Jan 1 and Dec 31
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    },
    handleYearChange() {
      this.maxDaysInRange = this.calculateMaxDays(this.selectedYear);

      // Reset all instruments to the first day of the selected year
      this.instruments.forEach((instrument) => {
        this.$set(this.currentDays, instrument, 1);
        this.checkImageExists(instrument);
      });
    },
    getStartDate() {
      return new Date(this.selectedYear, 0, 1); // January 1st of selected year
    },
    getEndDate() {
      if (this.isCurrentYear) {
        // Yesterday for current year
        return new Date(new Date().setDate(new Date().getDate() - 1));
      }
      // December 31st for previous years
      return new Date(this.selectedYear, 11, 31);
    },
    getDayForInstrument(instrument) {
      const startDate = new Date(this.selectedYear, 0, 1);
      const dayOffset = (this.currentDays[instrument] || 1) - 1;
      const resultDate = new Date(startDate);
      resultDate.setDate(startDate.getDate() + dayOffset);
      return resultDate;
    },
    formatDate(date) {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    },
    formatDateForUrl(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    },
    getSpectrogramUrl(instrumentId) {
      const date = this.getDayForInstrument(instrumentId);
      const dateStr = this.formatDateForUrl(date);
      return `${this.spectrogramsURL}/${this.selectedYear}/${instrumentId}/${instrumentId}_${dateStr}.png`;
    },
    checkImageExists(instrument) {
      const url = this.getSpectrogramUrl(instrument);

      // Check cache first
      const cacheKey = `${instrument}_${url}`;
      if (this.imageCache[cacheKey] !== undefined) {
        this.$set(this.imageExists, instrument, this.imageCache[cacheKey]);
        return;
      }

      const img = new Image();

      img.onload = () => {
        this.$set(this.imageExists, instrument, true);
        this.imageCache[cacheKey] = true;
      };

      img.onerror = () => {
        this.$set(this.imageExists, instrument, false);
        this.imageCache[cacheKey] = false;
      };

      img.src = url;
    },
  },
  watch: {
    currentDays: {
      handler(newValue) {
        // When any instrument's day changes, check its image
        Object.keys(newValue).forEach((instrument) => {
          this.checkImageExists(instrument);
        });
      },
      deep: true,
    },
    selectedYear() {
      // When year changes, update the URL structure and check images
      this.instruments.forEach((instrument) => {
        this.checkImageExists(instrument);
      });
    },
  },
  mounted() {
    // Initialize currentDays and imageExists for each instrument
    this.instruments.forEach((instrument) => {
      this.$set(this.currentDays, instrument, this.maxDaysInRange);
      this.$set(this.imageExists, instrument, false);
      this.checkImageExists(instrument);
    });
  },
};
</script>

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
