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
    hitlStatus: '',
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
          { key: '_botpt_', value: 'BOTPT' },
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
          { key: '_oxygen_', value: 'OXYGEN' },
          { key: '_chlorophyll_', value: 'FLUOROMETER' },
          { key: '_nitrate_', value: 'NUTNR' },
          { key: '_par_', value: 'PARAD' },
          { key: '_ph_', value: 'PHSEN' },
          { key: '_pco2_', value: 'PCO2W' },
          {
            key: '_spectral_irradiance_',
            value: 'SPKIR',
            groups: [
              { key: 'spectral_irradiance_412nm', value: 'Spectral Irradiance, 412nm' },
              { key: 'spectral_irradiance_443nm', value: 'Spectral Irradiance, 443nm' },
              { key: 'spectral_irradiance_490nm', value: 'Spectral Irradiance, 490nm' },
              { key: 'spectral_irradiance_510nm', value: 'Spectral Irradiance, 510nm' },
              { key: 'spectral_irradiance_555nm', value: 'Spectral Irradiance, 555nm' },
              { key: 'spectral_irradiance_620nm', value: 'Spectral Irradiance, 620nm' },
              { key: 'spectral_irradiance_683nm', value: 'Spectral Irradiance, 683nm' },
            ],
          },
          {
            key: '_velocity_',
            value: 'VELPT',
            groups: [
              { key: '_velocity_east', value: 'Velocity, East' },
              { key: '_velocity_north', value: 'Velocity, North' },
              { key: '_velocity_up', value: 'Velocity, Up' },
            ],
          },
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
        title: 'Data: By Status',
        route: '/status',
        external: false,
        hitl: 'Status',
        groups: [
          { key: 'Watch', value: 'Watchlist' },
          { key: 'Plotting', value: 'Plotting Issues' },
          { key: 'Harvest', value: 'Data Harvest Issues' },
        ],
      },

    ],
    aplSites: [
      {
        title: 'Nereus',
        route: 'https://nereus.ooirsn.uw.edu/',
        external: true,
      },
      {
        title: 'Nereus: Suspect Instrument List',
        route: 'https://nereus.ooirsn.uw.edu/suspect-instruments',
        external: true,
      },
      {
        title: 'Nereus M2M Plots',
        route: 'https://nereus.ooirsn.uw.edu/m2m-data-plots',
        external: true,
      },
      {
        title: 'APL Eng dashboard',
        route: 'http://eng.ooirsn.uw.edu/',
        external: true,
      },
      {
        title: 'APL RealTime Dashboard',
        route: 'http://rtime.ooirsn.uw.edu:8888/',
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
    STORE_HITL_STATUS: (state, hitlStatus) => {
      state.hitlStatus = hitlStatus;
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
    storeHITLStatus: ({ commit }, { hitlStatus }) => {
      commit('STORE_HITL_STATUS', hitlStatus);
    },
  },
  modules: {
  },
});
