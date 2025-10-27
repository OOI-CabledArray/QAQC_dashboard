<script lang="ts" setup>
import { createReusableTemplate } from '@vueuse/core'

import { useBreakpoints } from '@/breakpoints'
import {
  Button,
  Popover,
  Accordion,
  AccordionPanel,
  AccordionContent,
  AccordionHeader,
} from '@/components/base'
import { useStore } from '@/store'

const store = useStore()
const breakpoints = useBreakpoints()
const isWide = $(breakpoints.greaterOrEqual('sm'))

let topLinksPopover = $ref<InstanceType<typeof Popover> | null>(null)
let isShowingTopLinksPopover = $ref(false)

let groupPopover = $ref<InstanceType<typeof Popover> | null>(null)
let subgroupPopover = $ref<InstanceType<typeof Popover> | null>(null)

let selectedGroup = $ref<(typeof store.mainNav)[number] | null>(null)
let selectedSubgroup = $ref<(typeof store.mainNav)[number]['groups'][number] | null>(null)

const [DefineLinksTemplate, LinksTemplate] = createReusableTemplate()
</script>

<template>
  <div class="flex flex-col h-full not-sm:text-center p-4 root text-white">
    <!-- Header -->
    <a class="flex flex-nowrap flex-row items-center justify-center" href="/">
      <i class="fa-fish fas mb-1 rotate-[-12deg] sm:mr-4 text-[32px]" />
      <span class="font-semibold max-sm:hidden text-lg text-nowrap uppercase">Data QA/QC</span>
    </a>
    <div class="bg-white h-[1px] my-4 opacity-20" />

    <!-- Top Links -->
    <div>
      <Button
        class="cursor-pointer flex flex-row hover:opacity-100 items-center justify-center not-sm:flex-col not-sm:pl-1 not-sm:space-y-1 opacity-80"
        fluid
        text
        unstyled
        @click="(event: any) => topLinksPopover?.toggle(event)"
      >
        <i class="fa-chalkboard fas opacity-50" />
        <span class="not-sm:text-[8px] sm:ml-2 sm:pr-4 text-nowrap">APL + RCA Links</span>
        <i
          :class="[
            'fas not-sm:text-xs',
            isShowingTopLinksPopover ? 'fa-chevron-down' : 'fa-chevron-right',
          ]"
        />
      </Button>
      <Popover
        ref="topLinksPopover"
        class="p-4"
        @hide="isShowingTopLinksPopover = false"
        @show="isShowingTopLinksPopover = true"
      >
        <div class="space-y-2">
          <div v-for="(site, i) in store.aplSites" :key="i">
            <a :href="site.route" target="_blank">
              {{ site.title }}
              <i v-if="site.external" class="fa-external-link-alt fas" />
            </a>
          </div>
        </div>
      </Popover>
    </div>

    <!-- View List -->
    <div class="bg-white h-[1px] my-4 opacity-20" />
    <span class="font-bold mb-1 not-sm:text-center opacity-50 text-xs uppercase">Views</span>

    <DefineLinksTemplate v-slot="{ item }">
      <div class="bg-white border-1 border-gray-300 p-0 rounded-lg" :options="item.groups">
        <template v-for="(group, index) in item.groups" :key="index">
          <template v-if="!group.groups">
            <Button v-slot="props" as-child unstyled>
              <RouterLink
                :class="[props.class, 'text-sky-800 text-[17px] text-center block px-0.5 py-1']"
                :to="`/plots?keyword=${group.key}&subkey=-`"
              >
                {{ group.value }}
              </RouterLink>
            </Button>
          </template>
          <div v-else class="flex justify-center py-2 row">
            <Button
              class="bg-sky-800 block px-2 py-0.5 text-[17px] text-center"
              @click="
                (event: Event) => {
                  selectedSubgroup = group
                  subgroupPopover?.toggle?.(event)
                }
              "
            >
              {{ group.value }}
              <i class="fa-caret-down fa-sharp fas text-sm" />
            </Button>
          </div>
          <div v-if="index < item.groups.length - 1" class="bg-gray-300 h-[1px]" />
        </template>
      </div>
    </DefineLinksTemplate>

    <Accordion collapse-icon="none" expand-icon="none" unstyled :value="null">
      <template v-for="(item, i) in store.mainNav" :key="i">
        <AccordionPanel class="py-4" :value="+i">
          <AccordionHeader
            as="a"
            class="bg-transparent font-normal hover:text-white px-0 text-[17px] text-gray-300"
            :href="item.groups ? `#${item.route}` : item.route"
            :target="item.external ? '_blank' : undefined"
            @click="
              (event: Event) => {
                if (groupPopover?.toggle != null) {
                  selectedGroup = item
                  groupPopover.toggle(event)
                }
              }
            "
          >
            {{ item.title }}
          </AccordionHeader>
          <AccordionContent v-if="isWide">
            <LinksTemplate class="mt-4" :item="item" />
          </AccordionContent>
        </AccordionPanel>
      </template>
    </Accordion>
    <Popover v-if="!isWide" ref="groupPopover" unstyled @hide="selectedGroup = null">
      <div>
        <LinksTemplate v-if="selectedGroup" :item="selectedGroup" />
      </div>
    </Popover>
    <Popover ref="subgroupPopover">
      <template v-if="selectedSubgroup">
        <div v-for="subgroup in selectedSubgroup.groups ?? []" :key="subgroup.key" class="mb-2">
          <Button as-child>
            <RouterLink
              class="block px-0.5 py-1 text-center text-sm"
              :to="`/plots?keyword=${subgroup.key}&subkey=${subgroup.key}`"
              @click="subgroupPopover?.hide()"
            >
              {{ subgroup.value }}
            </RouterLink>
          </Button>
        </div>
      </template>
    </Popover>
    <div class="bg-white h-[1px] opacity-20" />
  </div>
</template>

<style scoped>
.root {
  background-color: #1862b2;
  background-image: linear-gradient(180deg, #1f73a3 10%, #040f30 100%);
  background-size: cover;
}
</style>
