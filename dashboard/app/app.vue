<template>
  <u-app>
    <u-main>
      <div class="app flex flex-row">
        <!-- Fixed Position Sidebar -->
        <div
          :class="[
            '-side-bar-container fixed h-lvh left-0 overflow-x-hidden overflow-y-auto',
            'overscroll-contain sm:w-56 top-0 w-26',
          ]"
        >
          <side-bar />
        </div>
        <!-- Sidebar Spacer -->
        <div class="flex-none h-lvh sm:w-56 w-26" />
        <!-- Page Container -->
        <div class="flex-auto">
          <suspense>
            <nuxt-layout>
              <nuxt-page />
            </nuxt-layout>
          </suspense>
        </div>
      </div>
    </u-main>
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
