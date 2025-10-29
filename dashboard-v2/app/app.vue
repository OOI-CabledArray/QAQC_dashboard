<template>
  <u-app>
    <div class="app flex flex-row">
      <div class="flex-none h-svh sm:w-56 w-[104px]">
        <side-bar />
      </div>
      <div class="flex-auto">
        <nuxt-page />
      </div>
    </div>
  </u-app>
</template>

<style>
html,
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: white;
  height: 100%;
  width: 100%;
  font-family: Avenir, Helvetica, Arial, sans-serif;
}
</style>
