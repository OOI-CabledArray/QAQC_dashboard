<template>
  <q-banner class="bg-grey-2 q-mt-lg">
    <div class="text-h4 q-mb-sm">RCA Data QA/QC Dashboard</div>
    <div class="text-subtitle1 q-mb-md">Updated daily at 0800 PST</div>
    <div class="row q-gutter-md justify-center">
      <img src="oceanographyUW.png" alt="UW Oceanography logo" class="small-logo">
      <img src="ooilogo.png" alt="OOI logo" class="small-logo">
      <img src="NSF.png" alt="NSF logo" class="med-logo">
    </div>
  </q-banner>
</template>

<script>
export default {
  name: 'HomePage',
  data() {
    return {
    };
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.home-page {
  height: 100%;
}
.small-logo {
  max-height: 100px;
}
.med-logo {
  max-height: 115px;
}
</style>
