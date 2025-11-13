<script lang="ts" setup>
import { isEqual } from 'lodash-es'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

type FilterGroup = (typeof filterGroups)[number]
type Filter = FilterGroup['filters'][number]
const filterGroups = [
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

function setFilter(group: FilterGroup, filter: Filter) {
  const query = {
    ...route.query,
  }

  query[group.key] = filter.key
  if (!isEqual(route.query, query)) {
    router.push({
      path: route.path,
      query,
    })
  }
}
</script>

<template>
  <div class="bg-gray-500 flex flex-row md:justify-end not-md:justify-center px-2 py-4">
    <div v-for="group in filterGroups" :key="group.key" class="mx-0.5">
      <u-popover>
        <u-button class="cursor-pointer hover:text-white text-gray-100" variant="link">
          {{ group.title }}
          <i class="-ml-0.5 fa-caret-down fas" />
        </u-button>
        <template #content>
          <div v-for="filter in group.filters" :key="filter.key" class="mb-2">
            <u-button
              class="cursor-pointer hover:opacity-80 px-4 py-2 text-gray-800! text-left w-full"
              variant="link"
              @click="setFilter(group, filter)"
            >
              {{ filter.value }}
            </u-button>
          </div>
        </template>
      </u-popover>
    </div>
  </div>
</template>
