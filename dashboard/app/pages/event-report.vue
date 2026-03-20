<script setup lang="ts">
definePageMeta({
  props: (route) => ({ ...route.query }),
})
</script>

<template>
  <event />
</template>
