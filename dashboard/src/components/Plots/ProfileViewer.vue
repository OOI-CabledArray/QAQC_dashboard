<template>
  <div>
    <b-form-input
        :id="`${refdes}--${variable}--selector`"
        type="range"
        v-model="profileIdx"
        min="0"
        :max="maxProfileIdx"
    >
    </b-form-input>
    <b-img :src="currentPlot.url" lazy fluid>
    </b-img>
  </div>
</template>

<script>
import _ from 'lodash';

export default {
  props: ['plots', 'variable', 'refdes'],
  data() {
    return {
      profileIdx: 0,
    };
  },
  methods: {
    sortByProfile(plots) {
      return _.sortBy(plots, 'profile');
    },
  },
  computed: {
    sortedPlots() {
      return this.sortByProfile(this.plots);
    },
    profiles() {
      return this.sortedPlots.map((o) => o.profile);
    },
    maxProfileIdx() {
      return this.profiles.length - 1;
    },
    currentPlot() {
      return this.sortedPlots[this.profileIdx];
    },
  },
};
</script>

<style>
</style>
