<template>
  <u-app>
    <div class="app flex flex-row">
      <!-- Fixed Position Sidebar -->
      <div class="fixed h-svh left-0 overflow-y-scroll sm:w-56 top-0 w-[104px]">
        <side-bar />
      </div>
      <!-- Sidebar Spacer -->
      <div class="flex-none h-full sm:w-56 w-[104px]" />
      <!-- Page Container -->
      <div class="flex-auto">
        <suspense>
          <nuxt-page />
        </suspense>
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
