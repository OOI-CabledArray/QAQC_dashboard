<template>
  <b-navbar toggleable="lg" type="dark" variant="dark">
    <b-navbar-toggle target="accordionSidebar"></b-navbar-toggle>
    <!-- Right aligned nav items -->
    <b-navbar-nav class="ml-auto">
      <b-nav-item-dropdown
        v-for="filter in navFilters"
        :key="filter.key"
        right
      >
        <!-- Using 'button-content' slot -->
        <template #button-content>
          {{ filter.title }}
        </template>
        <b-dropdown-item
          v-for="item in filter.filters"
          :key="item.key"
          @click="getPath(filter.key, item.key); checkFilterItem(item) "
        >
          {{ item.value }}
        </b-dropdown-item>
      </b-nav-item-dropdown>
    </b-navbar-nav>
  </b-navbar>
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
    checkFilterItem(item) {
     console.log(item);
     switch(item.key) {
      case 'dataRange': // if dataRange dropdown
        this.storeDatarange( {datarange: item.filters.key} ); // use key to set state in store
      break;
      case 'timeSpan':
        this.storeTimespan( {timespan: item.filters.key} );
      break;
      case 'overlays':
        this.storeOverlay( {overlay: item.filters.key} );
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
