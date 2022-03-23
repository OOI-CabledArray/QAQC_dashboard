import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    plotsURL: `${process.env.BASE_URL}QAQC_plots`,
    hitlURL: `${process.env.BASE_URL}HITL_notes`,
    plotList: [],
    hitlList: [],
    csvData: [],
    mainNav: [
      {
        title: 'Data: by Site',
        route: '/site',
        external: false,
        hitl: 'Sites',
        groups: [
          { key: 'CE02SHBP', value: 'CE02SHBP' },
          { key: 'CE04OSBP', value: 'CE04OSBP' },
          { key: 'CE04OSPD', value: 'CE04OSPD' },
          { key: 'CE04OSPS', value: 'CE04OSPS' },
          { key: 'RS01SBPD', value: 'RS01SBPD' },
          { key: 'RS01SBPS', value: 'RS01SBPS' },
          { key: 'RS01SLBS', value: 'RS01SLBS' },
          { key: 'RS01SUM1', value: 'RS01SUM1' },
          { key: 'RS01SUM2', value: 'RS01SUM2' },
          { key: 'RS03AXBS', value: 'RS03AXBS' },
          { key: 'RS03AXPD', value: 'RS03AXPD' },
          { key: 'RS03AXPS', value: 'RS03AXPS' },
          { key: 'RS03INT1', value: 'RS03INT1' },
          { key: 'RS03INT2', value: 'RS03INT2' },
          { key: 'RS03CCAL', value: 'RS03CCAL' },
          { key: 'RS03ECAL', value: 'RS03ECAL' },
          { key: 'RS03ASHS', value: 'RS03ASHS' },
        ],
      },
      {
        title: 'Data: by Platform Type',
        route: '/platform',
        external: false,
        hitl: 'Platforms',
        groups: [
          { key: 'BP-', value: 'BEP' },
          { key: 'PD-', value: 'Deep Profilers' },
          { key: 'PS-SF0', value: 'Shallow Profilers' },
          { key: 'PS-PC0', value: 'Shallow Profiler 200 m Platform' },
          {
            key: 'Seafloor-Drop',
            value: 'Seafloor',
            groups: [
              { key: 'ASHS', value: 'Ashes' },
              { key: 'AXBS', value: 'Axial Base' },
              { key: 'CCAL', value: 'Axial Central Caldera' },
              { key: 'ECAL', value: 'Axial Eastern Caldera' },
              { key: 'INT1', value: 'International District, 1' },
              { key: 'INT2', value: 'International District, 2' },
              { key: 'SLBS', value: 'Slope Base' },
              { key: 'SUM1', value: 'Axial Summit, 1' },
              { key: 'SUM2', value: 'Axial Summit, 2' },
            ],
          },
        ],
      },
      {
        title: 'Data: Stage 1',
        route: '/stage1',
        external: false,
        hitl: 'Stage1',
        groups: [
          { key: 'ADCP', value: 'ADCP' },
          { key: 'BOTPT', value: 'BOTPT' },
          {
            key: 'CTD',
            value: 'CTD',
            groups: [
              { key: 'temperature', value: 'Temperature' },
              { key: 'salinity', value: 'Salinity' },
              { key: 'density', value: 'Density' },
              { key: 'oxygen', value: 'Oxygen' },
            ],
          },
          { key: 'oxygen', value: 'OXYGEN' },
          { key: 'chlorophyll', value: 'FLUOROMETER' },
          { key: 'nitrate', value: 'NUTNR' },
          { key: 'par', value: 'PARAD' },
          { key: 'ph', value: 'PHSEN' },
          { key: 'pco2', value: 'PCO2W' },
          { key: 'SPKIR', value: 'SPKIR' },
          { key: 'VELPT', value: 'VELPT' },
        ],
      },
      {
        title: 'Data: Stage 2',
        route: '/stage2',
        external: false,
        hitl: 'Stage2',
        groups: [
          { key: 'CAMHD', value: 'CAMHD' },
          { key: 'OPTAA', value: 'OPTAA' },
          { key: 'PREST', value: 'PREST' },
          { key: 'THSPH', value: 'THSPH' },
          { key: 'TMPSF', value: 'TMPSF' },
          { key: 'TRHPH', value: 'TRHPH' },
          { key: 'VEL3D', value: 'VEL3D' },
          { key: 'ZPLSC', value: 'ZPLSC' },
        ],
      },
      {
        title: 'Data: Stage 3',
        route: '/stage3',
        external: false,
        hitl: 'Stage3',
        groups: [
          { key: 'CAMDS', value: 'CAMDS' },
          { key: 'HPIES', value: 'HPIES' },
          { key: 'HYDBB', value: 'HYDBB' },
          { key: 'HYDLF', value: 'HYDLF' },
          { key: 'MASSP', value: 'MASSP' },
          { key: 'OBSBB', value: 'OBSBB' },
          { key: 'OBSSP', value: 'OBSSP' },
        ],
      },
      {
        title: 'Data: Stage 4',
        route: '/stage4',
        external: false,
        hitl: 'Stage4',
        groups: [
          { key: 'FLOBNC', value: 'FLOBN CAT' },
          { key: 'FLOBNM', value: 'FLOBN Mosquito' },
          { key: 'OSMOIA', value: 'OSMO' },
          { key: 'PPS', value: 'PPS' },
          { key: 'RAS', value: 'RAS' },
          { key: 'D1000', value: 'D1000' },
        ],
      },
      {
        title: 'Alerts and Issues',
        route: 'http://status.ooirsn.uw.edu:8000/alarms',
        external: true,
      },
    ],
    aplSites: [
      {
        title: 'Nereus',
        route: 'http://status.ooirsn.uw.edu:8000/dashboard',
        external: true,
      },
      {
        title: 'APL Eng dashboard',
        route: 'http://eng.ooirsn.uw.edu/',
        external: true,
      },
      {
        title: 'APL RealTime Dashboard',
        route: 'http://rtime.ooirsn.uw.edu/',
        external: true,
      },
      {
        title: 'APL PP-Up',
        route: 'http://sea.ooirsn.uw.edu/power/graphs.html',
        external: true,
      },
      {
        title: 'APL Camera Videos by Day',
        route: 'http://dstill.ooirsn.uw.edu/',
        external: true,
      },
      {
        title: 'OMS',
        route: 'https://io.ocean.washington.edu/oms_data/',
        external: true,
      },
    ],
  },
  mutations: {
    STORE_PLOTS: (state, plots) => {
      state.plotList = plots;
    },
    STORE_HITL_NOTES: (state, notes) => {
      state.hitlList = notes;
    },
    APPEND_CSV: (state, data) => {
      state.csvData.push(data);
    },
  },
  actions: {
    storePlots: ({ commit }, { plots }) => {
      commit('STORE_PLOTS', plots);
    },
    storeHITLNotes: ({ commit }, { notes }) => {
      commit('STORE_HITL_NOTES', notes);
    },
    appendCSVData: ({ commit }, { data }) => {
      commit('APPEND_CSV', data);
    },
  },
  modules: {
  },
});
