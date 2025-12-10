<script lang="ts" setup>
import { useDiscrete } from '@/discrete'

const discrete = useDiscrete()

if (import.meta.browser) {
  await discrete.load()
}
</script>

<template>
  <div />
</template>
