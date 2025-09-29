<template>
  <!-- Sidebar -->
  <q-drawer
    v-model="drawer"
    :width="280"
    :breakpoint="1024"
    elevated
    class="bg-gradient-primary text-white"
  >
    <!-- Sidebar - Brand -->
    <div class="sidebar-brand q-pa-md text-center">
      <router-link to="/" class="text-white text-decoration-none">
        <div class="row items-center justify-center q-gutter-sm">
          <q-icon name="fas fa-fish" size="md" class="rotate-n-15" />
          <div class="text-h6">Data QA/QC</div>
        </div>
      </router-link>
    </div>

    <!-- Divider -->
    <q-separator color="white" />

    <q-list class="text-white">
      <!-- APL+RCA Links Dropdown -->
      <q-expansion-item
        icon="fas fa-chalkboard"
        label="APL+RCA Links"
        text-color="white"
        header-class="text-white"
      >
        <q-list>
          <q-item
            v-for="site in aplSites"
            :key="site.route"
            clickable
            :href="site.route"
            target="_blank"
            class="text-white"
          >
            <q-item-section>
              <q-item-label>{{ site.title }}</q-item-label>
            </q-item-section>
            <q-item-section side v-if="site.external">
              <q-icon name="fas fa-external-link-alt" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>

      <!-- Divider -->
      <q-separator color="white" class="q-my-md" />

      <!-- Heading -->
      <q-item-label header class="text-white text-weight-bold">Views</q-item-label>

      <!-- Navigation Items -->
      <div v-for="item in navList" :key="item.route">
        <!-- Items with groups (expandable) -->
        <q-expansion-item
          v-if="!item.external && item.groups"
          :label="item.title"
          text-color="white"
          header-class="text-white"
          @click="updateHITLStatus(item.hitl)"
        >
          <q-list>
            <div v-for="group in item.groups" :key="group.key">
              <!-- Simple group items -->
              <q-item
                v-if="!group.groups"
                clickable
                :to="{ path: `/plots?keyword=${group.key}&subkey=-` }"
                class="text-white"
              >
                <q-item-section>
                  <q-item-label>{{ group.value }}</q-item-label>
                </q-item-section>
              </q-item>

              <!-- Nested groups -->
              <q-expansion-item
                v-if="group.groups"
                :label="group.value"
                text-color="white"
                header-class="text-white q-pl-md"
              >
                <q-list>
                  <q-item
                    v-for="innerGroup in group.groups"
                    :key="innerGroup.key"
                    clickable
                    :to="{ path: `/plots?keyword=${group.key}&subkey=${innerGroup.key}` }"
                    class="text-white q-pl-lg"
                  >
                    <q-item-section>
                      <q-item-label>{{ innerGroup.value }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-expansion-item>
            </div>
          </q-list>
        </q-expansion-item>

        <!-- Items without groups -->
        <q-item
          v-else-if="!item.external && !item.groups"
          clickable
          :href="item.route"
          class="text-white"
          @click="updateHITLStatus(item.hitl)"
        >
          <q-item-section>
            <q-item-label>{{ item.title }}</q-item-label>
          </q-item-section>
        </q-item>

        <!-- External items -->
        <q-item
          v-else-if="item.external"
          clickable
          :href="item.route"
          target="_blank"
          class="text-white"
          @click="updateHITLStatus(item.hitl)"
        >
          <q-item-section>
            <q-item-label>{{ item.title }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="fas fa-external-link-alt" />
          </q-item-section>
        </q-item>
      </div>
    </q-list>
  </q-drawer>
  <!-- End of Sidebar -->
</template>

<script>
import { mapActions, mapState } from 'vuex';

export default {
  name: 'SideBar',
  props: ['navList'],
  data() {
    return {
      drawer: true, // Drawer is open by default
    };
  },
  mounted() {
    // Listen for sidebar toggle events
    this.$root.$on('toggle-sidebar', () => {
      this.drawer = !this.drawer;
    });
  },
  beforeDestroy() {
    this.$root.$off('toggle-sidebar');
  },
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
.list-group-item {
  padding: 0.25rem 0.5rem; /* Reduce padding */
  margin: 0; /* Remove margins */
}
.btn {
  padding: 0.1rem 0.6rem /* Reduce padding */
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
