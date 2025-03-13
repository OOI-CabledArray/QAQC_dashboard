<template>
    <div class="spectrogram-container">
      <div v-if="imageExists" class="spectrogram-display">
        <img :src="currentSpectrogramUrl" alt="Spectrogram" />
        <p class="date-display">{{ formatDate(currentDate) }}</p>
      </div>
      <div v-else class="no-data-message">
        <p>No spectrogram found for {{ formatDate(currentDate) }}</p>
      </div>

      <div class="slider-controls">
        <span>Jan 1, 2025</span>
        <input
          type="range"
          min="1"
          max="31"
          v-model.number="currentDay"
          class="date-slider"
        />
        <span>Jan 31, 2025</span>
      </div>
    </div>
  </template>

<script>
import { mapState } from 'vuex';

export default {
  props: {
    instrumentId: {
      type: String,
      default: 'HYDBBA105',
    },
  },
  data() {
    return {
      currentDay: 1,
      imageExists: false,
      imageCache: {}, // Cache to avoid repeated checks for the same date
    };
  },
  computed: {
    ...mapState(['spectrogramsURL']),

    currentDate() {
      // Create a Date object for January + the current day slider value
      return new Date(2025, 0, this.currentDay);
    },
    currentSpectrogramUrl() {
      const dateStr = this.formatDateForUrl(this.currentDate);
      // Using the spectrogramsURL from the Vuex store
      const currentSpectrogramUrl = `${this.spectrogramsURL}/2025/${this.instrumentId}/${this.instrumentId}_${dateStr}.png`;
      console.log(currentSpectrogramUrl);
      return currentSpectrogramUrl;
    },
  },
  methods: {
    formatDate(date) {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    },
    formatDateForUrl(date) {
      // Format date as YYYYMMDD for the URL
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    },
    checkImageExists() {
      // Check if we already tested this URL
      if (this.imageCache[this.currentSpectrogramUrl] !== undefined) {
        this.imageExists = this.imageCache[this.currentSpectrogramUrl];
        return;
      }

      const img = new Image();

      img.onload = () => {
        this.imageExists = true;
        this.imageCache[this.currentSpectrogramUrl] = true;
      };

      img.onerror = () => {
        this.imageExists = false;
        this.imageCache[this.currentSpectrogramUrl] = false;
      };

      // Set the source to trigger loading
      img.src = this.currentSpectrogramUrl;
    },
  },
  watch: {
    currentDay() {
      this.checkImageExists();
    },
  },
  mounted() {
    this.checkImageExists();
  },
};
</script>

<style scoped>
.spectrogram-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 800px;
  margin: 0 auto;
}

.spectrogram-display {
  width: 100%;
  margin-bottom: 20px;
}

.spectrogram-display img {
  width: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.date-display {
  text-align: center;
  font-weight: bold;
  margin-top: 10px;
}

.no-data-message {
  height: 450px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  width: 100%;
  border-radius: 4px;
  margin-bottom: 20px;
}

.slider-controls {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.date-slider {
  flex-grow: 1;
}

/* .loading-indicator {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
} */
</style>
