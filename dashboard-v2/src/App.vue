<script lang="ts" setup>
import SideBar from '@/components/SideBar.vue'
</script>

<template>
  <div id="app">
    <div id="wrapper">
      <side-bar />
      <div id="content-wrapper" class="d-flex flex-column">
        <!-- Main Content -->
        <div id="content">
          <router-view />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
html,
body {
  height: 100%;
  width: 100%;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  height: 100%;
  width: 100%;
}
</style>
