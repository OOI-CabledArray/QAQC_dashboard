<script lang="ts" setup>
import { useStore } from '@/store'

const store = useStore()
</script>

<template>
  <!-- Sidebar -->
  <ul id="accordionSidebar" class="accordion bg-gradient-primary navbar-nav sidebar sidebar-dark">
    <!-- Sidebar - Brand -->
    <a class="align-items-center d-flex justify-content-center sidebar-brand" href="/">
      <div class="rotate-n-15 sidebar-brand-icon">
        <i class="fa-fish fas" />
      </div>
      <div class="mx-3 sidebar-brand-text">Data QA/QC</div>
    </a>

    <!-- Divider -->
    <hr class="my-0 sidebar-divider" />

    <b-nav-item-dropdown>
      <template #button-content>
        <i class="fa-chalkboard fas" />
        <span>APL+RCA Links</span>
      </template>
      <b-dropdown-item
        v-for="site in store.aplSites"
        :key="site.route"
        :href="site.route"
        target="_blank"
      >
        {{ site.title }}
        <i v-if="site.external" class="fa-external-link-alt fas" />
      </b-dropdown-item>
    </b-nav-item-dropdown>

    <!-- Divider -->
    <hr class="sidebar-divider" />

    <!-- Heading -->
    <div class="sidebar-heading">Views</div>

    <li
      v-for="item in store.mainNav"
      :key="item.route"
      class="nav-item"
      @click="store.storeHITLStatus(item.hitl)"
    >
      <a
        v-if="!item.external && item.groups"
        v-b-toggle="`${item.route}`"
        class="nav-link"
        href="#"
      >
        {{ item.title }}</a
      >
      <a v-if="!item.external && !item.groups" class="nav-link" :href="item.route">
        {{ item.title }}</a
      >
      <a v-if="item.external" class="nav-link" :href="item.route" target="_blank">
        {{ item.title }}
        <i class="fa-external-link-alt fas" />
      </a>
      <b-collapse
        v-if="!item.external && item.groups"
        :id="item.route"
        accordion="my-accordion"
        role="tabpanel"
      >
        <b-list-group>
          <b-list-group-item v-for="group in item.groups" :key="group.key">
            <b-link v-if="!group.groups" :to="{ path: `/plots?keyword=${group.key}&subkey=-` }">
              {{ group.value }}
            </b-link>
            <b-dropdown
              v-if="group.groups"
              block
              class="m-2"
              dropright
              :text="group.value"
              variant="primary"
            >
              <b-dropdown-item
                v-for="innerGroup in group.groups"
                :key="innerGroup.key"
                :to="{ path: `/plots?keyword=${group.key}&subkey=${innerGroup.key}` }"
              >
                {{ innerGroup.value }}
              </b-dropdown-item>
            </b-dropdown>
          </b-list-group-item>
        </b-list-group>
      </b-collapse>
    </li>

    <!-- Divider -->
    <hr class="d-md-block d-none sidebar-divider" />
  </ul>
  <!-- End of Sidebar -->
</template>

<style>
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
</style>
