<template>
  <b-container fluid>
    <b-row>
      <b-col>
        <HITLOverview :id="statusId" />
      </b-col>
    </b-row>
  </b-container>
</template>

<script>
import HITLOverview from '@/components/HITL/Overview.vue';

export default {
  components: {
    HITLOverview,
  },
  computed: {
    statusId() {
      return this.$route.params.id;
    },
  },
};
</script>

<style>

</style>
