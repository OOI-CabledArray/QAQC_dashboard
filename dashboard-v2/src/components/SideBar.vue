<script lang="ts" setup>
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

let popover = $ref<InstanceType<typeof Popover> | null>(null)
let isShowingPopover = $ref(false)
</script>

<template>
  <div class="flex flex-col h-full p-4 root text-white">
    <!-- Header -->
    <a class="flex flex-row items-center" href="/">
      <i class="fa-fish fas mb-1 mr-4 rotate-[-8deg] text-[32px]" />
      <span class="font-semibold text-lg uppercase">Data QA/QC</span>
    </a>
    <div class="bg-white h-[1px] my-4 opacity-20" />

    <!-- Links -->
    <div>
      <Button
        class="cursor-pointer hover:opacity-100 opacity-80"
        fluid
        text
        type="button"
        unstyled
        @click="(event: any) => popover?.toggle(event)"
      >
        <i class="fa-chalkboard fas opacity-50" />
        <span class="ml-2 pr-4">APL + RCA Links</span>
        <i :class="['fas', isShowingPopover ? 'fa-chevron-down' : 'fa-chevron-right']" />
      </Button>
      <Popover ref="popover" v-model="isShowingPopover">
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
    <span class="font-bold mb-1 opacity-50 text-xs uppercase">Views</span>
    <Accordion collapse-icon="none" expand-icon="none" unstyled :value="null">
      <AccordionPanel v-for="(item, i) in store.mainNav" :key="i" class="py-4" :value="String(i)">
        <AccordionHeader
          as="a"
          class="bg-transparent font-normal hover:text-white px-0 text-[17px] text-gray-300"
          :href="item.groups ? `#${item.route}` : item.route"
          :target="item.external ? '_blank' : undefined"
        >
          {{ item.title }}
        </AccordionHeader>
        <AccordionContent> Content </AccordionContent>
      </AccordionPanel>
    </Accordion>
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

<!-- <style>
#sidebar-no-header {
  margin-top: 56px;
}

.list-group-item {
  padding: 0.25rem 0.5rem; /* Reduce padding */
  margin: 0; /* Remove margins */
}

.btn {
  padding: 0.1rem 0.6rem; /* Reduce padding */
}

.bg-gradient-primary {
  background-color: #1862b2;
  background-image: linear-gradient(180deg, #1f73a3 10%, #040f30 100%);
  background-size: cover;
}

.toggle {
  color: #fff;
  background-color: #1b239e;
  border-color: #1b239e;
}

.btn-primary {
  color: #fff;
  background-color: #2267b1;
  border-color: #2267b1;
}

.btn-primary:hover {
  color: #fff;
  background-color: #1b239e;
  border-color: #1b239e;
}

.show > .btn-primary.dropdown-toggle {
  color: #fff;
  background-color: #2267b1;
  border-color: #2267b1;
}

button:focus:not(:focus-visible) {
  outline: 0;
  background-color: #2267b1;
  color: #fff;
}

a {
  color: #224bb1;
  text-decoration: none;
  background-color: transparent;
}
</style> -->
