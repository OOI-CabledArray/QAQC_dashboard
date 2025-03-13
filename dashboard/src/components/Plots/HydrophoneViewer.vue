<template>
    <div class="spectrograms-container">
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
          <span>Jan 1, 2025</span>
          <input
            type="range"
            min="1"
            max="60"
            v-model.number="currentDays[instrument]"
            class="date-slider"
          />
          <span>Mar 1, 2025</span>
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
      default: () => ['HYDBBA105', 'HYDBBA106'],
    },
  },
  data() {
    return {
      currentDays: {},
      imageExists: {},
      imageCache: {}, // Cache structure: { instrumentId_url: boolean }
    };
  },
  computed: {
    ...mapState(['spectrogramsURL']),
  },
  methods: {
    getDayForInstrument(instrument) {
      return new Date(2025, 0, this.currentDays[instrument] || 1);
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
      return `${this.spectrogramsURL}/2025/${instrumentId}/${instrumentId}_${dateStr}.png`;
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
  },
  mounted() {
    // Initialize currentDays and imageExists for each instrument
    this.instruments.forEach((instrument) => {
      this.$set(this.currentDays, instrument, 1);
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
    max-width: 800px;
    margin: 0 auto;
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
    height: 400px;
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
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .date-slider {
    flex-grow: 1;
  }
  </style>
