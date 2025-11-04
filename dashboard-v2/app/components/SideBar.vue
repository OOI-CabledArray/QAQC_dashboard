<script lang="ts" setup>
import type { AccordionItem } from '@nuxt/ui'
import { createReusableTemplate } from '@vueuse/core'

import { useBreakpoints } from '@/breakpoints'
import None from '@/components/None.vue'
import { useStore } from '@/store'

const store = useStore()
const route = useRoute()
const breakpoints = useBreakpoints()
const isWide = $computed(() => (import.meta.client ? breakpoints.greaterOrEqual('sm').value : true))

const isShowingTopLinksPopover = $ref(false)

type Item = (typeof store.mainNav)[number]

const [DefineLinksTemplate, LinksTemplate] = createReusableTemplate({
  props: {
    item: {
      type: Object as () => Item,
      required: true,
    },
  },
})

const accordionItems = $computed(() => {
  return store.mainNav.map(
    (item) =>
      ({
        item,
        label: item.title,
      }) satisfies AccordionItem,
  )
})
</script>

<template>
  <div class="flex flex-col min-h-full not-sm:text-center p-4 root text-white">
    <!-- Header -->
    <a class="flex flex-nowrap flex-row items-center justify-center" href="/">
      <i class="-rotate-12 fa-fish fas mb-1 sm:mr-4 text-[32px]" />
      <span class="font-semibold max-sm:hidden text-lg text-nowrap uppercase">Data QA/QC</span>
    </a>
    <div class="bg-white h-px mb-2 mt-3 opacity-20" />

    <!-- Top Links -->
    <div>
      <u-popover v-model:open="isShowingTopLinksPopover" mode="click">
        <u-button
          :class="[
            'cursor-pointer',
            'flex',
            'flex-row',
            'items-center',
            'justify-center',
            'not-sm:flex-col',
            'not-sm:pl-1',
            'not-sm:space-y-1',
            'text-gray-200',
            'hover:text-white',
          ]"
          variant="link"
        >
          <i class="fa-chalkboard fas opacity-50" />
          <span class="not-sm:text-[8px] sm:ml-2 sm:pr-4 text-nowrap">APL + RCA Links</span>
          <i
            :class="[
              'fas not-sm:text-xs',
              isShowingTopLinksPopover ? 'fa-chevron-down' : 'fa-chevron-right',
            ]"
          />
        </u-button>
        <template #content>
          <div class="px-4 py-2 space-y-2">
            <div v-for="(site, i) in store.aplSites" :key="i">
              <a class="text-sm" :href="site.route" target="_blank">
                {{ site.title }}
                <i v-if="site.external" class="fa-external-link-alt fas" />
              </a>
            </div>
          </div>
        </template>
      </u-popover>
    </div>

    <!-- Views -->
    <div class="bg-white h-px mb-4 mt-2 opacity-20" />
    <span class="font-bold mb-1 not-sm:text-center opacity-50 text-xs uppercase">Views</span>

    <define-links-template v-slot="{ item }">
      <div class="bg-white rounded-lg" :options="item.groups">
        <template v-for="(group, index) in item.groups" :key="index">
          <template v-if="!group.groups">
            <nuxt-link
              class="block px-4 py-1 text-[17px] text-center text-primary-800"
              :to="`/plots?keyword=${group.key}&subkey=-`"
            >
              {{ group.value }}
            </nuxt-link>
          </template>
          <div v-else class="flex justify-center py-2 row">
            <u-popover>
              <u-button class="bg-primary-700 block px-2 py-0.5 text-[17px]">
                {{ group.value }}
                <i class="fa-caret-down fa-sharp fas text-sm" />
              </u-button>
              <template #content>
                <div v-for="subgroup in group.groups ?? []" :key="subgroup.key" class="mb-2 px-4">
                  <nuxt-link
                    class="block py-1 text-center text-sm"
                    :to="`/plots?keyword=${subgroup.key}&subkey=${subgroup.key}`"
                  >
                    {{ subgroup.value }}
                  </nuxt-link>
                </div>
              </template>
            </u-popover>
          </div>
          <div v-if="index < item.groups.length - 1" class="bg-gray-300 h-px" />
        </template>
      </div>
    </define-links-template>

    <!-- If we're on a wide enough screen, render items in an accordion. -->
    <u-accordion
      v-if="isWide"
      :items="accordionItems"
      :trailing-icon="None"
      :ui="{
        header: 'hover:opacity-100 opacity-75',
        label: 'cursor-pointer text-[16px]',
        content: 'p-0',
        item: 'border-0',
      }"
    >
      <template #default="scope">
        <span class="cursor-pointer">{{ scope.item.label }}</span>
      </template>
      <template #content="scope">
        <links-template class="mt-1" :item="scope.item.item" />
      </template>
    </u-accordion>

    <!-- Otherwise, use popover menus. -->
    <template v-else>
      <div v-for="(item, i) in store.mainNav" :key="i" class="mb-4">
        <u-popover
          :key="route.fullPath"
          :content="{ side: 'right', align: 'start', sideOffset: 28, alignOffset: 8 }"
        >
          <u-button class="hover:text-white text-[13px] text-gray-300" variant="link">
            {{ item.title }}
          </u-button>
          <template #content>
            <links-template :item="item" />
          </template>
        </u-popover>
      </div>
    </template>
    <div class="bg-white h-px opacity-20" />
  </div>
</template>

<style scoped>
.root {
  background-color: #1f73a3;
  background-image: linear-gradient(180deg, #1f73a3 10%, #040f30 100%);
  background-size: cover;
}
</style>
