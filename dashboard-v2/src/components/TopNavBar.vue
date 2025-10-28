<script lang="ts" setup>
import { isEqual } from 'lodash-es'
import { useRoute, useRouter } from 'vue-router'

import { Button, Popover } from '@/components/base'

const route = useRoute()
const router = useRouter()

let selectedFilterGroup: FilterGroup | null = $ref(null)
let popover = $ref<InstanceType<typeof Popover> | null>(null)

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
  selectedFilterGroup = group
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
  <div class="bg-gray-500 flex flex-row justify-end px-2 py-4">
    <div v-for="group in filterGroups" :key="group.key" class="mx-0.5">
      <Button
        @click="
          (event) => {
            selectedFilterGroup = group
            popover?.toggle(event)
          }
        "
      >
        {{ group.title }}
        <i class="fa-caret-down fas ml-[-2px]" />
      </Button>
    </div>
    <Popover ref="popover">
      <template v-if="selectedFilterGroup != null">
        <div v-for="filter in selectedFilterGroup.filters" :key="filter.key" class="mb-2">
          <Button
            class="block px-4 py-2 text-left w-full"
            text
            @click="
              () => {
                if (selectedFilterGroup != null) {
                  setFilter(selectedFilterGroup, filter)
                  popover?.hide()
                }
              }
            "
          >
            {{ filter.value }}
          </Button>
        </div>
      </template>
    </Popover>

    <!-- <b-navbar-nav class="ml-auto">
      <b-nav-item-dropdown v-for="filter in navFilters" :key="filter.key" right>
        <template #button-content>
          {{ filter.title }}
        </template>
        <b-dropdown-item
          v-for="item in filter.filters"
          :key="item.key"
          @click="setPath(filter.key, item.key)"
        >
          {{ item.value }}
        </b-dropdown-item>
      </b-nav-item-dropdown>
    </b-navbar-nav> -->
  </div>
</template>
