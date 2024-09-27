<template>
  <b-jumbotron
    class="mt-5"
    header="RCA Data QA/QC Dashboard"
    lead="Updated daily at 0800 PST">
    <img src="oceanographyUW.png" alt="UW Oceanography logo" class="small-logo">
    <img src="ooilogo.png" alt="OOI logo" class="small-logo">
    <img src="NSF.png" alt="NSF logo" class="med-logo">
  </b-jumbotron>
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
    background-color: #daedf1;
}
</style>
