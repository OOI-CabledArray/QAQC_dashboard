<template>
  <!-- Sidebar -->
  <ul
    class="navbar-nav bg-gradient-primary sidebar sidebar-dark accordion"
    id="accordionSidebar"
  >
    <!-- Sidebar - Brand -->
    <a
      class="sidebar-brand d-flex align-items-center justify-content-center"
      href="/"
    >
      <div class="sidebar-brand-icon rotate-n-15">
        <i class="fas fa-fish"></i>
      </div>
      <div class="sidebar-brand-text mx-3">Data QA/QC</div>
    </a>

    <!-- Divider -->
    <hr class="sidebar-divider my-0" />

    <b-nav-item-dropdown>
      <template #button-content>
        <i class="fas fa-chalkboard"></i>
        <span>APL Status Dashboards</span>
      </template>
      <b-dropdown-item
        v-for="site in aplSites"
        :key="site.route"
        :href="site.route"
        target="_blank"
      >
        {{ site.title }}
        <i class="fas fa-external-link-alt" v-if="site.external"></i>
      </b-dropdown-item>
    </b-nav-item-dropdown>

    <!-- Divider -->
    <hr class="sidebar-divider" />

    <!-- Heading -->
    <div class="sidebar-heading">Interface</div>

    <li class="nav-item" v-for="item in navList" :key="item.route"
      v-on:click="updateHITLStatus(item.hitl)">
      <a
        class="nav-link"
        v-if="!item.external && item.groups"
        v-b-toggle="`${item.route}`"
        href="#"
      >
        {{ item.title }}</a
      >
      <a
        class="nav-link"
        v-if="!item.external && !item.groups"
        :href="item.route"
      >
        {{ item.title }}</a
      >
      <a
        class="nav-link"
        v-if="item.external"
        :href="item.route"
        target="_blank"
      >
        {{ item.title }}
        <i class="fas fa-external-link-alt"></i>
      </a>
      <b-collapse
        v-if="!item.external && item.groups"
        :id="item.route"
        accordion="my-accordion"
        role="tabpanel"
      >
        <b-list-group>
          <b-list-group-item>
            <b-link :to="{ path: `/status/${item.hitl}`}">
              HITL Status
            </b-link>
          </b-list-group-item>
          <b-list-group-item v-for="group in item.groups" :key="group.key">
            <b-link
              v-if="!group.groups"
              :to="{ path: `/plots?keyword=${group.key}&subkey=-` }"
              >{{ group.value }}</b-link>
            <b-dropdown
              dropright
              v-if="group.groups"
              :text="group.value"
              variant="primary"
              class="m-2"
              block
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
    <hr class="sidebar-divider d-none d-md-block" />
  </ul>
  <!-- End of Sidebar -->
</template>

<script>
import { mapActions, mapState } from 'vuex';

export default {
  name: 'SideBar',
  props: ['navList'],
  computed: {
    ...mapState({
      aplSites: (state) => state.aplSites,
      // DataRange: (state) => state.DataRange,
      // TimeSpan: (state) => state.TimeSpan,
      // Overlay: (state) => state.Overlay,

    }),
  },
  methods: {
    ...mapActions([
      'storeHITLStatus',
    ]),
    updateHITLStatus(statusId) { // this is actually a general filter function not just HITL
      this.storeHITLStatus({ hitlStatus: statusId });
    },
  },
};
</script>

<style>
#sidebar-no-header {
  margin-top: 56px;
}
</style>
