<script setup lang="ts">
definePageMeta({
  props: (route) => ({ ...route.query }),
})
</script>

<template>
  <client-only>
    <discrete-page />
  </client-only>
</template>
