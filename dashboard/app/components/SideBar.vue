<script lang="ts" setup>
import type { AccordionItem } from '@nuxt/ui'
import { createReusableTemplate } from '@vueuse/core'

import { useBreakpoints } from '~/breakpoints'
import None from '~/components/None.vue'
import { useStore } from '~/store'

const store = useStore()
const route = useRoute()
const breakpoints = useBreakpoints()
const isWide = $computed(() => (import.meta.client ? breakpoints.greaterOrEqual('sm').value : true))

const isShowingTopLinksPopover = $ref(false)
const isShowingArchivesPopover = $ref(false)

type AuthUser = { id: string; email: string; name: string; role: string }
let authUser = $ref<AuthUser | null>(null)

async function fetchAuthUser() {
  try {
    authUser = await $fetch('/api/me')
  } catch {
    authUser = null
  }
}

async function logout() {
  try {
    await $fetch('/api/logout', { method: 'POST' })
  } catch {
    // Ignore errors
  }
  authUser = null
}

let archiveName = $ref<string | null>(null)
let archiving = $ref(false)
let showArchiveDialog = $ref(false)

function cancelArchiveDialog() {
  showArchiveDialog = false
  archiveName = null
}

async function triggerArchive() {
  archiving = true
  try {
    await $fetch('/api/archives', {
      method: 'POST',
      body: archiveName ? { name: archiveName } : {},
    })
    archiveName = null
    showArchiveDialog = false
  } catch (error: any) {
    console.error('Archive failed:', error)
  } finally {
    archiving = false
  }
}

if (import.meta.client) {
  fetchAuthUser()
}

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
      <u-popover
        v-model:open="isShowingTopLinksPopover"
        :content="{ side: 'right', sideOffset: 24 }"
        mode="click"
      >
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
            v-if="isWide"
            :class="['fas', isShowingTopLinksPopover ? 'fa-chevron-down' : 'fa-chevron-right']"
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
          <div v-else class="flex justify-center p-2 row">
            <u-popover>
              <u-button class="bg-primary-700 block px-2 py-0.5 text-[17px]">
                {{ group.value }}
                <i class="fa-caret-down fa-sharp fas text-sm" />
              </u-button>
              <template #content="{ close }">
                <div v-for="subgroup in group.groups ?? []" :key="subgroup.key" class="mb-2 px-4">
                  <nuxt-link
                    class="block py-1 text-center text-sm"
                    :to="`/plots?keyword=${group.key}&subkey=${subgroup.key}`"
                    @click="close"
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
    <u-button
      class="hover:text-white mt-1 px-0 sm:text-[16px] text-[13px] text-gray-300"
      to="/discrete"
      variant="link"
    >
      Discrete Data
    </u-button>
    <div class="bg-white h-px mb-1 mt-2 opacity-20" />
    <u-button
      class="hover:text-white mt-1 px-0 sm:text-[16px] text-[13px] text-gray-300"
      to="/event-report"
      variant="link"
    >
      Event Report
    </u-button>

    <!-- Archives -->
    <div class="mt-auto pt-3">
      <div class="bg-white h-px mb-2 opacity-20" />
    </div>
    <div>
      <u-popover
        v-model:open="isShowingArchivesPopover"
        :content="{ side: 'right', sideOffset: 28 }"
        mode="click"
      >
        <u-button
          :class="[
            'cursor-pointer',
            'flex',
            'flex-row',
            'items-center',
            'not-sm:flex-col',
            'not-sm:justify-center',
            'not-sm:pl-1',
            'not-sm:space-y-1',
            'text-gray-200',
            'hover:text-white',
            'w-full',
          ]"
          variant="link"
        >
          <i class="fa-archive fas opacity-50" />
          <span class="grow not-sm:text-[8px] sm:ml-2 text-left text-nowrap">Archives</span>
          <i
            v-if="isWide"
            :class="['fas', isShowingArchivesPopover ? 'fa-chevron-down' : 'fa-chevron-right']"
          />
        </u-button>
        <template #content>
          <div class="p-3 space-y-2 w-64">
            <archive-dropdown />
            <div v-if="authUser">
              <div class="bg-gray-200 h-px my-2" />
              <div v-if="!showArchiveDialog" class="flex justify-center">
                <u-button size="xs" variant="ghost" @click="showArchiveDialog = true">
                  <i class="fa-plus fas mr-1 text-xs" />
                  Create Event Archive
                </u-button>
              </div>
              <div v-else class="space-y-1">
                <u-input
                  v-model="archiveName"
                  class="text-xs w-full"
                  placeholder="Name"
                  size="xs"
                />
                <div class="flex gap-1">
                  <u-button
                    block
                    :disabled="!archiveName"
                    :loading="archiving"
                    size="xs"
                    @click="triggerArchive"
                  >
                    Create
                  </u-button>
                  <u-button size="xs" variant="ghost" @click="cancelArchiveDialog">
                    Cancel
                  </u-button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </u-popover>
    </div>

    <!-- Auth -->
    <div class="bg-white h-px mb-2 mt-2 opacity-20" />
    <div class="text-center">
      <template v-if="authUser">
        <span class="block mb-1 text-gray-400 text-xs">{{ authUser.name }}</span>
        <u-button
          class="hover:text-white px-0 text-[13px] text-gray-300"
          variant="link"
          @click="logout"
        >
          Log Out
        </u-button>
      </template>
      <u-button
        v-else
        class="hover:text-white px-0 text-[13px] text-gray-300"
        to="/login"
        variant="link"
      >
        Log In
      </u-button>
    </div>
  </div>
</template>

<style scoped>
.root {
  background-color: #1f73a3;
  background-image: linear-gradient(180deg, #1f73a3 10%, #040f30 100%);
  background-size: cover;
}
</style>
