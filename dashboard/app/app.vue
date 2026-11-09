<script setup lang="ts">
useHead({
  title: 'Data QA/QC',
})

// Below `sm` the sidebar is an overlay rather than a permanent column, so it
// stops eating a quarter of a phone screen. Visibility is driven by Tailwind
// breakpoint variants; this only tracks the open state of the overlay.
const route = useRoute()
let sidebarOpen = $ref(false)

watch(
  () => route.fullPath,
  () => {
    sidebarOpen = false
  },
)
</script>

<template>
  <u-app :toaster="{ position: 'bottom-center' }">
    <u-main>
      <div class="app flex flex-row">
        <!-- Opens the sidebar overlay on small screens. -->
        <u-button
          aria-label="Toggle navigation"
          class="fixed left-2 print:hidden sm:hidden top-2 z-30"
          icon="i-lucide-menu"
          size="sm"
          @click="sidebarOpen = !sidebarOpen"
        />
        <div
          v-if="sidebarOpen"
          class="bg-black/40 fixed inset-0 print:hidden sm:hidden z-10"
          @click="sidebarOpen = false"
        />
        <!-- Fixed Position Sidebar -->
        <div
          :class="[
            '-side-bar-container fixed h-lvh left-0 overflow-x-hidden overflow-y-auto z-20',
            'max-sm:w-26 overscroll-contain sm:w-56 top-0 transition-transform',
            sidebarOpen ? 'translate-x-0' : 'max-sm:-translate-x-full',
          ]"
        >
          <side-bar />
        </div>
        <!-- Sidebar Spacer: no reserved column once the sidebar is an overlay. -->
        <div class="flex-none h-lvh max-sm:w-0 sm:w-56" />
        <!-- Page Container -->
        <div class="flex-auto max-sm:pt-12 overflow-hidden">
          <client-only>
            <archive-banner />
          </client-only>
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

@media print {
  .-side-bar-container,
  .-side-bar-container + div {
    display: none !important;
  }
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
