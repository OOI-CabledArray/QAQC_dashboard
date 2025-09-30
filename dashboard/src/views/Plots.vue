<template>
  <div>
  <TopNavBar />
  <div class="q-pa-md">
    <div class="row">
      <div class="col">
        <PlotsOverview
          :keyword="keyword"
          :subkey="subkey"
          :dataRange="dataRange"
          :timeSpan="timeSpan"
          :overlays="overlays"
        />
      </div>
    </div>
  </div>
  </div>
</template>

<script>
import PlotsOverview from '@/components/Plots/Overview.vue';
import TopNavBar from '@/components/TopNavBar.vue';

export default {
  components: {
    PlotsOverview,
    TopNavBar,
  },
  props: {
    keyword: {
      type: String,
      required: true,
    },
    subkey: {
      type: String,
      required: true,
    },
    dataRange: {
      type: String,
      default: 'full',
    },
    timeSpan: {
      type: String,
      default: 'week',
    },
    overlays: {
      type: String,
      default: 'none',
    },
  },
};
</script>

<style>

</style>
