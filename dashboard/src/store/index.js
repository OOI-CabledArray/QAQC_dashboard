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
    DataRange: '', // TODO new state properties
    TimeSpan: '', // hopefully we can use these to filter
    Overlay: '', // instead of the props in each file
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
            key: '-',
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
          {
            key: 'ADCP',
            value: 'ADCP',
            groups: [
              { key: '_velocity_east', value: 'Velocity, East' },
              { key: '_velocity_north', value: 'Velocity, North' },
              { key: '_velocity_up', value: 'Velocity, Up' },
              { key: '_error_seawater_velocity', value: 'Velocity Error' },
              { key: '_corrected_echo_intensity', value: 'Echo Intensity' },
              { key: '_correlation_magnitude', value: 'Correlation Magnitude' },
              { key: '_percent_good_beam', value: 'Beam' },
            ],
          },
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
          { key: '_oxygen_', value: 'OXYGEN' },
          {
            key: 'FLOR',
            value: 'FLUOROMETER',
            groups: [
              { key: '_chlorophyll_', value: 'Chlorophyll-a' },
              { key: '_cdom_', value: 'CDOM' },
              { key: '_backscatter_', value: 'Backscatter' },
            ],
          },
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
            key: 'VELPT',
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
          {
            key: 'OPTAA',
            value: 'OPTAA',
            groups: [
              { key: 'temp', value: 'Temperature' },
              { key: 'dark', value: 'Dark Counts' },
              { key: 'ratio', value: 'Ratios' },
            ],
          },

          {
            key: 'PREST',
            value: 'PREST',
            groups: [
              { key: 'seafloor_pressure', value: 'Seafloor Pressure' },
              { key: 'temp', value: 'Temperature' },
            ],
          },
          { key: 'TMPSF', value: 'TMPSF' },
          {
            key: 'TRHPH',
            value: 'TRHPH',
            groups: [
              { key: 'temp', value: 'Temperature' },
              { key: 'resistivity', value: 'Resistivity' },
            ],
          },
          {
            key: 'VEL3D',
            value: 'VEL3D',
            groups: [
              { key: '_velocity_east', value: 'Velocity, East' },
              { key: '_velocity_north', value: 'Velocity, North' },
              { key: '_velocity_up', value: 'Velocity, Up' },
              { key: '_amplitude', value: 'Echo Intensity' },
              { key: '_correlation', value: 'Correlation Magnitude' },
              { key: '_seawater_pressure_mbar', value: 'Seawater Pressure, mbar' },
            ],
          },
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
      {
        title: 'PMEL Axial Forecast',
        route: 'https://www.pmel.noaa.gov/eoi/axial_blog.html#:~:text=With%20rates%20of%20inflation%20out,year%20window%2C%20for%20now).',
        external: true,
      },
      {
        title: 'Axial Earthquake Catalog',
        route: 'http://axial.ocean.washington.edu/#name1',
        external: true,
      },
    ],
  },
  mutations: {
    STORE_PLOTS: (state, plots) => { // updates the state.plotList with current selections
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
    STORE_DATARANGE: (state, datarange) => {
      state.DataRange = datarange;
    },
    STORE_TIMESPAN: (state, timespan) => {
      state.TimeSpan = timespan;
    },
    STORE_OVERLAY: (state, overlay) => {
      state.Overlay = overlay;
    },
  },
  actions: {
    storePlots: ({ commit }, { plots }) => { // commits plots to STORE_PLOTS
      console.log(plots);
      commit('STORE_PLOTS', plots);
    },
    storeHITLNotes: ({ commit }, { notes }) => {
      console.log(notes);
      commit('STORE_HITL_NOTES', notes);
    },
    appendCSVData: ({ commit }, { data }) => {
      console.log(data);
      commit('APPEND_CSV', data);
    },
    storeHITLStatus: ({ commit }, { hitlStatus }) => {
      console.log(hitlStatus);
      commit('STORE_HITL_STATUS', hitlStatus);
    },
    storeDatarange: ({ commit }, { datarange }) => {
      console.log(datarange);
      commit('STORE_DATARANGE', datarange);
    },
    storeTimespan: ({ commit }, { timespan }) => {
      console.log(timespan);
      commit('STORE_TIMESPAN', timespan);
    },
    storeOverlay: ({ commit }, { overlay }) => {
      console.log(overlay);
      commit('STORE_OVERLAY', overlay);
    },
  },
  modules: {
  },
});
