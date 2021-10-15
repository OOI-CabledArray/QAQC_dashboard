import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    plotsURL: `${process.env.BASE_URL}QAQC_plots`,
    hitlURL: `${process.env.BASE_URL}HITL_notes`,
    plotList: [],
    hitlList: [],
  },
  mutations: {
    STORE_PLOTS: (state, plots) => {
      state.plotList = plots;
    },
    STORE_HITL_NOTES: (state, notes) => {
      state.hitlList = notes;
    },
  },
  actions: {
    storePlots: ({ commit }, { plots }) => {
      commit('STORE_PLOTS', plots);
    },
    storeHITLNotes: ({ commit }, { notes }) => {
      commit('STORE_HITL_NOTES', notes);
    },
  },
  modules: {
  },
});
