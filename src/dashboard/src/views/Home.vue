<template>
  <b-container fluid>
    <HomePage />
  </b-container>
</template>

<script>
// @ is an alias to /src
import HomePage from '@/components/HomePage.vue';

export default {
  name: 'Home',
  components: {
    HomePage,
  },
};
</script>

<style scoped>
</style>
