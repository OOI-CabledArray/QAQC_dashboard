<script lang="ts" setup>
import { isEqual } from 'lodash-es'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const navFilters = [
  {
    title: 'Data Range',
    key: 'dataRange',
    filters: [
      { key: 'full', value: 'full range' },
      { key: 'standard', value: 'standard range' },
      { key: 'local', value: 'local range' },
    ],
  },
  {
    title: 'Time Spans',
    key: 'timeSpan',
    filters: [
      { key: 'day', value: '1 day' },
      { key: 'week', value: '1 week' },
      { key: 'month', value: '1 month' },
      { key: 'year', value: '1 year' },
      { key: 'deploy', value: 'deploy' },
    ],
  },
  {
    title: 'Overlays',
    key: 'overlays',
    filters: [
      { key: 'anno', value: 'Annotations' },
      { key: 'clim', value: 'Climatology' },
      { key: 'flag', value: 'Flagged Data' },
      { key: 'near', value: 'Nearest Neighbor' },
      { key: 'time', value: 'Time Machine' },
      { key: 'none', value: 'None' },
    ],
  },
] as const

function setPath(key: string, value: string) {
  const query = {
    ...route.query,
  }

  query[key] = value
  if (!isEqual(route.query, query)) {
    router.push({
      path: route.path,
      query,
    })
  }
}
</script>

<template>
  <b-navbar toggleable="lg" type="dark" variant="dark">
    <b-navbar-toggle target="accordionSidebar" />
    <!-- Right aligned nav items -->
    <b-navbar-nav class="ml-auto">
      <b-nav-item-dropdown v-for="filter in navFilters" :key="filter.key" right>
        <!-- Using 'button-content' slot -->
        <template #button-content>
          {{ filter.title }}
        </template>
        <!-- @click = on click performs following functions -->
        <b-dropdown-item
          v-for="item in filter.filters"
          :key="item.key"
          @click="setPath(filter.key, item.key)"
        >
          {{ item.value }}
        </b-dropdown-item>
      </b-nav-item-dropdown>
    </b-navbar-nav>
  </b-navbar>
</template>
