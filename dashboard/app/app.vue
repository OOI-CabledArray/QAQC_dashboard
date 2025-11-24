<template>
  <u-app>
    <div class="app flex flex-row h-0">
      <!-- Fixed Position Sidebar -->
      <div
        :class="[
          '-side-bar-container fixed h-svh left-0 overflow-x-hidden overflow-y-auto sm:w-56 top-0',
          'w-[104px]',
        ]"
      >
        <side-bar />
      </div>
      <!-- Sidebar Spacer -->
      <div class="flex-none h-lvh overscroll-none sm:w-56 w-[104px]" />
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

<style scoped>
.-side-bar-container::-webkit-scrollbar {
  display: none; /* Chrome, Safari */
}

.-side-bar-container {
  scrollbar-width: none; /* Firefox */
}
</style>
