<script lang="ts" setup>
definePageMeta({
  props: (route) => ({ ...route.query }),
})
</script>

<template>
  <plots-page :="$props" />
</template>
