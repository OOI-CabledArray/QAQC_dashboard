<template>
  <q-toolbar class="bg-dark text-white">
    <q-btn
      flat
      round
      dense
      icon="menu"
      @click="toggleSidebar"
    />
    <q-space />
    <!-- Right aligned nav items -->
    <div class="row q-gutter-sm">
      <q-btn-dropdown
        v-for="filter in navFilters"
        :key="filter.key"
        color="primary"
        :label="filter.title"
      >
        <q-list>
          <q-item
            v-for="item in filter.filters"
            :key="item.key"
            clickable
            v-close-popup
            @click="getPath(filter.key, item.key); checkFilterItem(item)"
          >
            <q-item-section>
              <q-item-label>{{ item.value }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
    </div>
  </q-toolbar>
</template>

<script>
import _ from 'lodash';
import { mapActions } from 'vuex';

export default {
  data() {
    return {
      currentKeyword: null,
      currentDataRange: null,
      currentTimeSpan: null,
      currentOverlays: null,
      navFilters: [
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
      ],
    };
  },
  methods: {
    ...mapActions([ // these reference actions in vue store
      'storeDatarange',
      'storeTimespan',
      'storeOverlay',
    ]),
    toggleSidebar() {
      // Emit event to root to toggle sidebar
      this.$root.$emit('toggle-sidebar');
    },
    checkFilterItem(item) {
      console.log(item);
      switch (item.key) {
        case 'dataRange': // if dataRange dropdown
          this.storeDatarange({ datarange: item.filters.key }); // use key to set state in store
          break;
        case 'timeSpan':
          this.storeTimespan({ timespan: item.filters.key });
          break;
        case 'overlays':
          this.storeOverlay({ overlay: item.filters.key });
          break;
        default:
      }
    },
    getPath(key, value) {
      const query = {
        ...this.$route.query,
      };
      query[key] = value;
      if (!_.isEqual(this.$route.query, query)) {
        this.$router.push({
          path: this.$route.path,
          query,
        });
      }
    },
  },
};
</script>

<style>
</style>
