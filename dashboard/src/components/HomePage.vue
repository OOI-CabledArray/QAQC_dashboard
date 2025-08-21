<template>
  <div class="jumbotron mt-5 p-5 mb-4 bg-light rounded-3">
    <div class="container-fluid py-5">
      <h1 class="display-5 fw-bold">RCA Data QA/QC Dashboard</h1>
      <p class="col-md-8 fs-4">Updated daily at 0800 PST</p>
      <img src="oceanographyUW.png" alt="UW Oceanography logo" class="small-logo">
      <img src="ooilogo.png" alt="OOI logo" class="small-logo">
      <img src="NSF.png" alt="NSF logo" class="med-logo">
    </div>
  </div>
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
.jumbotron {
    background-color: #f8f9fc;
}
</style>
