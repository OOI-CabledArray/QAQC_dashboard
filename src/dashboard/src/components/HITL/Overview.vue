<template>
  <div class="text-left pt-3">
      <div v-for="item in csvTables" :key="item.name">
          <h5>{{item.name}}</h5>
          <b-table striped hover fixed :items="item.data" thead-class="d-none"></b-table>
          <hr/>
      </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import _ from 'lodash';

export default {
  props: ['id'],
  mounted() {
  },
  methods: {
    filterCSVs(csvs) {
      return _.filter(csvs, (csv) => csv.name.includes(`HITL_${this.id}`));
    },
  },
  computed: {
    ...mapState({
      allCSVData: (state) => state.csvData,
    }),
    filteredCSVs() {
      return this.filterCSVs(this.allCSVData);
    },
    csvTables() {
      return this.filteredCSVs.map((csv) => {
        const cleanedData = csv.data.map((d) => _.zipObject(['ref', 'value'], d));
        return {
          name: csv.name.split('_').at(-1),
          data: _.sortBy(cleanedData, (o) => o.ref.split('-').at(-1)),
        };
      });
    },
  },
};
</script>

<style>

</style>
