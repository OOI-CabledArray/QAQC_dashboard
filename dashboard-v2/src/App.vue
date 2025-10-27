<script lang="ts" setup>
import SideBar from '@/components/SideBar.vue'
</script>

<template>
  <div class="app flex">
    <div class="flex-none h-svh sm:w-[224px] w-[104px]">
      <side-bar />
    </div>
    <div class="flex-auto">
      <router-view />
    </div>
  </div>
</template>

<style>
html,
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: white;
  height: 100%;
  width: 100%;
}

.app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
}
</style>
