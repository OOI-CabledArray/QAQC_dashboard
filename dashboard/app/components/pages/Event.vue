<script lang="ts" setup>
import { computed, onMounted, watch } from 'vue'
import JSZip from 'jszip'
import { useDebounceFn } from '@vueuse/core'
import { parseDate, type CalendarDate } from '@internationalized/date'

import { useStore } from '~/store'

const store = useStore()

// prettier-ignore
const SITES_CSV_URL = 'https://raw.githubusercontent.com/OOI-CabledArray/rca-data-tools/main/rca_data_tools/qaqc/params/sitesDictionary.csv'
// prettier-ignore
const VARIABLE_MAP_URL = 'https://raw.githubusercontent.com/OOI-CabledArray/rca-data-tools/main/rca_data_tools/qaqc/params/variableMap.csv'

let instruments = $ref<{ key: string; label: string }[]>([])
let parameters = $ref<{ key: string; label: string }[]>([])

// refDes -> list of variableNames from sitesDictionary.dataParameters
const instrumentParams = new Map<string, string[]>()
// parameter key -> list of variableNames from variableMap
const parameterVariables = new Map<string, string[]>()

/** RFC-4180-compatible CSV row parser (handles quoted fields with embedded commas/quotes). */
function parseCSVRow(row: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0
  while (i < row.length) {
    const ch = row[i]
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"'
        i += 2
      } else {
        inQuotes = !inQuotes
        i++
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
      i++
    } else {
      current += ch
      i++
    }
  }
  result.push(current.trim())
  return result
}

// Strip a single layer of surrounding double-quotes if present (artifact of triple-quoting in CSV).
function stripQuotes(s: string): string {
  return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s
}

function getParametersForInstrument(refDes: string): { key: string; label: string }[] {
  if (!refDes) return parameters
  const instVars = instrumentParams.get(refDes) ?? []
  if (instVars.length === 0) return parameters
  return parameters.filter((p) => {
    const vars = parameterVariables.get(p.key) ?? []
    return vars.some((v) => instVars.includes(v))
  })
}

type Panel = {
  instrument: string
  timespan: string
  range: string
  overlay: string
  parameter: string
  description: string
  descriptionOpen: boolean
}

// ── Presets ───────────────────────────────────────────────────────────────────
type PresetEntry = Partial<Omit<Panel, 'description' | 'descriptionOpen'>> & { instrument: string }

// prettier-ignore
const PRESET_TSUNAMI: PresetEntry[] = [
  { instrument: 'RS03AXBS-MJ03A-06-PRESTA301', parameter: 'seafloor_pressure',  overlay: 'none' },
  { instrument: 'RS01SLBS-MJ01A-06-PRESTA101', parameter: 'seafloor_pressure',  overlay: 'none' },
  { instrument: 'RS01SUM1-LJ01B-09-PRESTB102', parameter: 'seafloor_pressure',  overlay: 'none' },
  { instrument: 'CE02SHBP-LJ01D-06-CTDBPN106', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'CE04OSBP-LJ01C-06-CTDBPO108', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'RS01SLBS-LJ01A-12-CTDPFB101', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'RS03AXBS-LJ03A-12-CTDPFB301', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'RS03ASHS-MJ03B-10-CTDPFB304', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'RS03CCAL-MJ03F-12-CTDPFB305', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-12-CTDPFB306', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'RS03INT2-MJ03D-11-CTDPFB307', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'RS01SBPS-PC01A-4A-CTDPFA103', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'CE04OSPS-PC01B-4A-CTDPFA109', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'RS03AXPS-PC03A-4A-CTDPFA303', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'RS03ASHS-MJ03B-09-BOTPTA304', parameter: 'seafloor_uplift_5m', overlay: 'none' },
  { instrument: 'RS03CCAL-MJ03F-05-BOTPTA301', parameter: 'seafloor_uplift_5m', overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-06-BOTPTA302', parameter: 'seafloor_uplift_5m', overlay: 'none' },
  { instrument: 'RS03INT2-MJ03D-06-BOTPTA303', parameter: 'seafloor_uplift_5m', overlay: 'none' },
]

// prettier-ignore
const PRESET_EARTHQUAKE: PresetEntry[] = [
  // BOTPT — all params
  { instrument: 'RS03ASHS-MJ03B-09-BOTPTA304', parameter: 'seafloor_uplift_10m', overlay: 'none' },
  { instrument: 'RS03ASHS-MJ03B-09-BOTPTA304', parameter: 'mean_seafloor_depth', overlay: 'none' },
  { instrument: 'RS03CCAL-MJ03F-05-BOTPTA301', parameter: 'seafloor_uplift_10m', overlay: 'none' },
  { instrument: 'RS03CCAL-MJ03F-05-BOTPTA301', parameter: 'mean_seafloor_depth', overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-06-BOTPTA302', parameter: 'seafloor_uplift_10m', overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-06-BOTPTA302', parameter: 'mean_seafloor_depth', overlay: 'none' },
  { instrument: 'RS03INT2-MJ03D-06-BOTPTA303', parameter: 'seafloor_uplift_10m', overlay: 'none' },
  { instrument: 'RS03INT2-MJ03D-06-BOTPTA303', parameter: 'mean_seafloor_depth', overlay: 'none' },
  // OBSBB
  { instrument: 'RS01SLBS-MJ01A-05-OBSBBA102', parameter: '', overlay: 'none' },
  { instrument: 'RS01SUM1-LJ01B-05-OBSBBA101', parameter: '', overlay: 'none' },
  { instrument: 'RS03AXBS-MJ03A-05-OBSBBA303', parameter: '', overlay: 'none' },
  { instrument: 'RS03CCAL-MJ03F-06-OBSBBA301', parameter: '', overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-09-OBSBBA302', parameter: '', overlay: 'none' },
  // OBSSP
  { instrument: 'RS01SUM1-LJ01B-06-OBSSPA103', parameter: '', overlay: 'none' },
  { instrument: 'RS01SUM1-LJ01B-07-OBSSPA102', parameter: '', overlay: 'none' },
  { instrument: 'RS01SUM1-LJ01B-08-OBSSPA101', parameter: '', overlay: 'none' },
  { instrument: 'RS03ASHS-MJ03B-05-OBSSPA302', parameter: '', overlay: 'none' },
  { instrument: 'RS03ASHS-MJ03B-06-OBSSPA301', parameter: '', overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-05-OBSSPA303', parameter: '', overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-08-OBSSPA304', parameter: '', overlay: 'none' },
  { instrument: 'RS03INT2-MJ03D-05-OBSSPA305', parameter: '', overlay: 'none' },
]

// prettier-ignore
const PRESET_VOLCANO: PresetEntry[] = [
  // BOTPT
  { instrument: 'RS03CCAL-MJ03F-05-BOTPTA301', parameter: 'mean_seafloor_depth',  overlay: 'none' },
  { instrument: 'RS03CCAL-MJ03F-05-BOTPTA301', parameter: 'seafloor_uplift_10m',  overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-06-BOTPTA302', parameter: 'mean_seafloor_depth',  overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-06-BOTPTA302', parameter: 'seafloor_uplift_10m',  overlay: 'none' },
  { instrument: 'RS03INT2-MJ03D-06-BOTPTA303', parameter: 'mean_seafloor_depth',  overlay: 'none' },
  { instrument: 'RS03INT2-MJ03D-06-BOTPTA303', parameter: 'seafloor_uplift_10m',  overlay: 'none' },
  { instrument: 'RS03ASHS-MJ03B-09-BOTPTA304', parameter: 'mean_seafloor_depth',  overlay: 'none' },
  { instrument: 'RS03ASHS-MJ03B-09-BOTPTA304', parameter: 'seafloor_uplift_10m',  overlay: 'none' },
  // OBSBB
  { instrument: 'RS03CCAL-MJ03F-06-OBSBBA301', parameter: '', overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-09-OBSBBA302', parameter: '', overlay: 'none' },
  { instrument: 'RS03AXBS-MJ03A-05-OBSBBA303', parameter: '', overlay: 'none' },
  // OBSSP
  { instrument: 'RS03ASHS-MJ03B-06-OBSSPA301', parameter: '', overlay: 'none' },
  { instrument: 'RS03ASHS-MJ03B-05-OBSSPA302', parameter: '', overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-05-OBSSPA303', parameter: '', overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-08-OBSSPA304', parameter: '', overlay: 'none' },
  { instrument: 'RS03INT2-MJ03D-05-OBSSPA305', parameter: '', overlay: 'none' },
  // HYDLF
  { instrument: 'RS03AXBS-MJ03A-05-HYDLFA301', parameter: '', overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-09-HYDLFA304', parameter: '', overlay: 'none' },
  { instrument: 'RS03CCAL-MJ03F-06-HYDLFA305', parameter: '', overlay: 'none' },
  // HYDBB
  { instrument: 'RS03AXBS-LJ03A-09-HYDBBA302', parameter: '', overlay: 'none' },
  // TRHPH
  { instrument: 'RS03INT1-MJ03C-10-TRHPHA301', parameter: 'vent_temperature', overlay: 'none' },
  { instrument: 'RS03INT1-MJ03C-10-TRHPHA301', parameter: 'resistivity_5',          overlay: 'none' },
  { instrument: 'RS03INT1-MJ03C-09-TRHPHA302', parameter: 'vent_temperature', overlay: 'none' },
  { instrument: 'RS03INT1-MJ03C-09-TRHPHA302', parameter: 'resistivity_5',          overlay: 'none' },
  // TMPSF
  { instrument: 'RS03ASHS-MJ03B-07-TMPSFA301', parameter: 'temperature01',          overlay: 'none' },
  // CTD — Chadwick (no oxygen)
  { instrument: 'RS03AXBS-LJ03A-12-CTDPFB301', parameter: 'temperature',       overlay: 'none' },
  { instrument: 'RS03AXBS-LJ03A-12-CTDPFB301', parameter: 'salinity',           overlay: 'none' },
  { instrument: 'RS03AXBS-LJ03A-12-CTDPFB301', parameter: 'density',            overlay: 'none' },
  { instrument: 'RS03AXBS-LJ03A-12-CTDPFB301', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'RS03ASHS-MJ03B-10-CTDPFB304', parameter: 'temperature',       overlay: 'none' },
  { instrument: 'RS03ASHS-MJ03B-10-CTDPFB304', parameter: 'salinity',           overlay: 'none' },
  { instrument: 'RS03ASHS-MJ03B-10-CTDPFB304', parameter: 'density',            overlay: 'none' },
  { instrument: 'RS03ASHS-MJ03B-10-CTDPFB304', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'RS03CCAL-MJ03F-12-CTDPFB305', parameter: 'temperature',       overlay: 'none' },
  { instrument: 'RS03CCAL-MJ03F-12-CTDPFB305', parameter: 'salinity',           overlay: 'none' },
  { instrument: 'RS03CCAL-MJ03F-12-CTDPFB305', parameter: 'density',            overlay: 'none' },
  { instrument: 'RS03CCAL-MJ03F-12-CTDPFB305', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-12-CTDPFB306', parameter: 'temperature',       overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-12-CTDPFB306', parameter: 'salinity',           overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-12-CTDPFB306', parameter: 'density',            overlay: 'none' },
  { instrument: 'RS03ECAL-MJ03E-12-CTDPFB306', parameter: 'sea_water_pressure', overlay: 'none' },
  { instrument: 'RS03INT2-MJ03D-11-CTDPFB307', parameter: 'temperature',       overlay: 'none' },
  { instrument: 'RS03INT2-MJ03D-11-CTDPFB307', parameter: 'salinity',           overlay: 'none' },
  { instrument: 'RS03INT2-MJ03D-11-CTDPFB307', parameter: 'density',            overlay: 'none' },
  { instrument: 'RS03INT2-MJ03D-11-CTDPFB307', parameter: 'sea_water_pressure', overlay: 'none' },
  // CTD — non-Chadwick (with oxygen)
  { instrument: 'RS03AXPS-SF03A-2A-CTDPFA302', parameter: 'temperature',        overlay: 'none' },
  { instrument: 'RS03AXPS-SF03A-2A-CTDPFA302', parameter: 'salinity',            overlay: 'none' },
  { instrument: 'RS03AXPS-SF03A-2A-CTDPFA302', parameter: 'density',             overlay: 'none' },
  { instrument: 'RS03AXPS-SF03A-2A-CTDPFA302', parameter: 'sea_water_pressure',  overlay: 'none' },
  { instrument: 'RS03AXPS-SF03A-2A-CTDPFA302', parameter: 'oxygen',    overlay: 'none' },
  { instrument: 'RS03AXPS-PC03A-4A-CTDPFA303', parameter: 'temperature',        overlay: 'none' },
  { instrument: 'RS03AXPS-PC03A-4A-CTDPFA303', parameter: 'salinity',            overlay: 'none' },
  { instrument: 'RS03AXPS-PC03A-4A-CTDPFA303', parameter: 'density',             overlay: 'none' },
  { instrument: 'RS03AXPS-PC03A-4A-CTDPFA303', parameter: 'sea_water_pressure',  overlay: 'none' },
  { instrument: 'RS03AXPS-PC03A-4A-CTDPFA303', parameter: 'oxygen',    overlay: 'none' },
  // PREST
  { instrument: 'RS03AXBS-MJ03A-06-PRESTA301', parameter: 'seafloor_pressure',  overlay: 'none' },
]

// prettier-ignore
const PRESET_MARINE_HEATWAVE: PresetEntry[] = [
  { instrument: 'CE02SHBP-LJ01D-06-CTDBPN106', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'CE04OSBP-LJ01C-06-CTDBPO108', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'RS01SLBS-LJ01A-12-CTDPFB101', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'RS03AXBS-LJ03A-12-CTDPFB301', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'RS03ASHS-MJ03B-10-CTDPFB304', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'RS03CCAL-MJ03F-12-CTDPFB305', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'RS03ECAL-MJ03E-12-CTDPFB306', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'RS03INT2-MJ03D-11-CTDPFB307', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'RS01SBPS-PC01A-4A-CTDPFA103', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'CE04OSPS-PC01B-4A-CTDPFA109', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'RS03AXPS-PC03A-4A-CTDPFA303', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'RS01SBPS-SF01A-2A-CTDPFA102', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'RS01SBPS-SF01A-2A-CTDPFA102', parameter: 'temperature', overlay: 'none' },
  { instrument: 'CE04OSPS-SF01B-2A-CTDPFA107', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'CE04OSPS-SF01B-2A-CTDPFA107', parameter: 'temperature', overlay: 'none' },
  { instrument: 'RS03AXPS-SF03A-2A-CTDPFA302', parameter: 'temperature', overlay: 'clim' },
  { instrument: 'RS03AXPS-SF03A-2A-CTDPFA302', parameter: 'temperature', overlay: 'none' },
]
// ─────────────────────────────────────────────────────────────────────────────

const presetTimespans = $ref<string>('week')
let globalRange = $ref<string>('full')

watch($$(globalRange), (val) => {
  for (const panel of panels) panel.range = val
})

const timeSpans = [
  { key: 'day', label: '1 Day' },
  { key: 'week', label: '1 Week' },
  { key: 'month', label: '1 Month' },
  { key: 'year', label: '1 Year' },
  { key: 'deploy', label: 'Deployment' },
]

const overlays = [
  { key: 'none', label: 'None' },
  { key: 'anno', label: 'Annotations' },
  { key: 'time', label: 'Time Machine' },
  { key: 'clim', label: 'Climatology' },
  { key: 'profile', label: 'Profile' },
]

const ranges = [
  { key: 'full', label: 'Full' },
  { key: 'local', label: 'Local' },
  { key: 'standard', label: 'Standard' },
]

let eventDate = $ref('')
let eventName = $ref('')
let linkCopied = $ref(false)
const imageLoadErrors = $ref<string[]>([])
let isDownloadingZip = $ref(false)
let showDownloadConfirm = $ref(false)
let downloadController: AbortController | null = null

const totalPlotCount = computed(() =>
  panels.reduce((sum, panel) => sum + getMatchingPlots(panel).length, 0),
)

const calendarDate = computed<CalendarDate | undefined>({
  get() {
    if (!eventDate) return undefined
    try {
      return parseDate(eventDate)
    } catch {
      return undefined
    }
  },
  set(val) {
    eventDate = val?.toString() ?? ''
  },
})

function isAcoustic(instrument: string): boolean {
  const id = instrument.split('-').pop() ?? ''
  return id.startsWith('HYDBB') || id.startsWith('HYDLF') || id.startsWith('ZPLS')
}

function getAcousticUrl(instrument: string): string | null {
  if (!eventDate) return null
  const id = instrument.split('-').pop() ?? ''
  const dateStr = eventDate.replace(/-/g, '')
  const year = eventDate.slice(0, 4)
  const base = id.startsWith('ZPLS') ? store.echogramsURL : store.spectrogramsURL
  return `${base}/${year}/${id}/${id}_${dateStr}.png`
}

function hasVisibleImages(panel: Panel): boolean {
  const urls = getMatchingPlots(panel)
  return urls.length > 0 && urls.some((u) => !imageLoadErrors.includes(u))
}

const panels = $ref<Panel[]>([
  {
    instrument: '',
    timespan: 'week',
    range: 'full',
    overlay: 'none',
    parameter: '',
    description: '',
    descriptionOpen: false,
  },
])
let isLoading = $ref(false)

onMounted(async () => {
  restoreFromUrl()
  isLoading = true
  await Promise.all([
    store.plotList.length === 0 ? store.getPlots() : Promise.resolve(),
    fetch(SITES_CSV_URL)
      .then((r) => r.text())
      .then((text) => {
        const lines = text.trim().split('\n')
        const headers = parseCSVRow(lines[0] ?? '')
        const refDesIdx = headers.indexOf('refDes')
        const dataParamsIdx = headers.indexOf('dataParameters')
        instruments = lines.slice(1).flatMap((row) => {
          const cols = parseCSVRow(row)
          const refDes = cols[refDesIdx]?.trim()
          if (!refDes) return []
          const vars = stripQuotes(cols[dataParamsIdx]?.trim() ?? '')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
          instrumentParams.set(refDes, vars)
          return [{ key: refDes, label: refDes }]
        })
      }),
    fetch(VARIABLE_MAP_URL)
      .then((r) => r.text())
      .then((text) => {
        const lines = text.trim().split('\n')
        const headers = parseCSVRow(lines[0] ?? '')
        const paramIdx = headers.indexOf('parameter')
        const varNamesIdx = headers.indexOf('variableNames')
        parameters = lines.slice(1).flatMap((row) => {
          const cols = parseCSVRow(row)
          const param = cols[paramIdx]?.trim()
          if (!param) return []
          const vars = stripQuotes(cols[varNamesIdx]?.trim() ?? '')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
          parameterVariables.set(param, vars)
          return [{ key: param, label: param }]
        })
      }),
  ])
  isLoading = false
})

function addPanel() {
  panels.push({
    instrument: '',
    timespan: 'week',
    range: 'full',
    overlay: 'none',
    parameter: '',
    description: '',
    descriptionOpen: false,
  })
}

function removePanel(i: number) {
  panels.splice(i, 1)
}

function getMatchingPlots(panel: Panel): string[] {
  if (!panel.instrument) return []
  if (isAcoustic(panel.instrument)) {
    const url = getAcousticUrl(panel.instrument)
    return url ? [url] : []
  }
  if (!panel.timespan) return []
  return store.plotList
    .filter((plot) => {
      if (
        !plot.includes(panel.instrument) ||
        !plot.includes(panel.timespan) ||
        !plot.includes(panel.range) ||
        !plot.endsWith('.png')
      )
        return false
      if (plot.includes('meters')) return false
      if (plot.includes('profile') && panel.overlay !== 'profile') return false
      if (panel.overlay === 'profile' && !plot.includes('none')) return false
      if (panel.parameter && !plot.includes(panel.parameter)) return false
      if (panel.overlay && !plot.includes(panel.overlay)) return false
      return true
    })
    .map((plot) => `${store.plotsURL}/${plot}`)
}

function instrumentLabel(key: string): string {
  return instruments.find((i) => i.key === key)?.label ?? key
}

function timespanLabel(key: string): string {
  return timeSpans.find((t) => t.key === key)?.label ?? key
}

function loadPreset(preset: PresetEntry[], timespans: string[], name = '') {
  if (name) eventName = name
  panels.splice(
    0,
    panels.length,
    ...timespans.flatMap((timespan) =>
      preset.map((entry) => ({
        instrument: entry.instrument,
        timespan,
        range: 'full',
        overlay: entry.overlay ?? 'none',
        parameter: entry.parameter ?? '',
        description: '',
        descriptionOpen: false,
      })),
    ),
  )
}

function encodeState(): string {
  return btoa(
    encodeURIComponent(
      JSON.stringify({
        d: eventDate,
        n: eventName,
        p: panels.map((panel) => ({
          i: panel.instrument,
          t: panel.timespan,
          r: panel.range,
          o: panel.overlay,
          v: panel.parameter,
        })),
      }),
    ),
  )
}

function restoreFromUrl() {
  const param = new URL(window.location.href).searchParams.get('s')
  if (!param) return
  try {
    const state = JSON.parse(decodeURIComponent(atob(param)))
    if (state.d) eventDate = state.d
    if (state.n) eventName = state.n
    if (Array.isArray(state.p) && state.p.length > 0) {
      panels.splice(
        0,
        panels.length,
        ...state.p.map((p: { i: string; t: string; r: string; o: string; v: string }) => ({
          instrument: p.i ?? '',
          timespan: p.t ?? 'week',
          range: p.r ?? 'full',
          overlay: p.o ?? 'none',
          parameter: p.v ?? '',
          description: '',
          descriptionOpen: false,
        })),
      )
    }
  } catch {
    // invalid URL state — ignore
  }
}

const syncUrl = useDebounceFn(() => {
  const url = new URL(window.location.href)
  url.searchParams.set('s', encodeState())
  history.replaceState(null, '', url.toString())
}, 600)

watch(
  () => ({
    p: panels.map((p) => ({
      i: p.instrument,
      t: p.timespan,
      r: p.range,
      o: p.overlay,
      v: p.parameter,
    })),
    d: eventDate,
    n: eventName,
  }),
  syncUrl,
  { deep: true },
)

async function copyLink() {
  const url = new URL(window.location.href)
  url.searchParams.set('s', encodeState())
  await navigator.clipboard.writeText(url.toString())
  linkCopied = true
  setTimeout(() => {
    linkCopied = false
  }, 2000)
}

function downloadPDF() {
  window.print()
}

function resetReport() {
  eventDate = ''
  eventName = ''
  globalRange = 'full'
  panels.splice(0, panels.length, {
    instrument: '',
    timespan: 'week',
    range: 'full',
    overlay: 'none',
    parameter: '',
    description: '',
    descriptionOpen: false,
  })
}

async function downloadImages() {
  showDownloadConfirm = false
  isDownloadingZip = true
  downloadController = new AbortController()
  const { signal } = downloadController
  try {
    const zip = new JSZip()
    const folderName = eventName || 'event'
    const folder = zip.folder(folderName)!

    for (const panel of panels) {
      if (!panel.instrument) continue
      for (const url of getMatchingPlots(panel)) {
        if (signal.aborted) break
        try {
          const res = await fetch(url, { signal })
          folder.file(url.split('/').pop() ?? 'image.png', await res.blob())
        } catch {
          // skip unavailable or aborted images
        }
      }
      if (signal.aborted) break
    }

    if (!signal.aborted) {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }))
      a.download = `${folderName}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
    }
  } finally {
    isDownloadingZip = false
    downloadController = null
  }
}

function cancelDownload() {
  downloadController?.abort()
}
</script>

<template>
  <div class="image-report-root p-6">
    <!-- Page header (hidden when printing) -->
    <div class="mb-4 no-print">
      <div class="flex items-center justify-between mb-3">
        <h1 class="font-bold text-3xl sm:text-4xl text-highlighted">Event Report</h1>
        <div class="flex gap-2">
          <u-button
            icon="i-lucide-rotate-ccw"
            size="lg"
            variant="outline"
            color="neutral"
            @click="resetReport"
          >
            Reset
          </u-button>
          <u-button
            :icon="linkCopied ? 'i-lucide-check' : 'i-lucide-link'"
            size="lg"
            variant="outline"
            @click="copyLink"
          >
            {{ linkCopied ? 'Copied!' : 'Copy Link' }}
          </u-button>
          <u-button
            v-if="!isDownloadingZip"
            icon="i-lucide-images"
            size="lg"
            variant="outline"
            @click="showDownloadConfirm = true"
          >
            Download Images
          </u-button>
          <u-button
            v-else
            icon="i-lucide-x"
            size="lg"
            variant="outline"
            color="error"
            @click="cancelDownload"
          >
            Cancel Download
          </u-button>
          <u-modal v-model:open="showDownloadConfirm">
            <template #content>
              <u-card>
                <template #header>
                  <p class="font-semibold text-base">Download Images</p>
                </template>
                <p class="text-sm text-gray-700">
                  Download {{ totalPlotCount }} plot{{ totalPlotCount === 1 ? '' : 's' }}
                  as a ZIP file? This may take a moment.
                </p>
                <template #footer>
                  <div class="flex justify-end gap-2">
                    <u-button variant="ghost" @click="showDownloadConfirm = false">Cancel</u-button>
                    <u-button icon="i-lucide-images" @click="downloadImages">Download</u-button>
                  </div>
                </template>
              </u-card>
            </template>
          </u-modal>
          <u-button icon="i-lucide-file-down" size="lg" variant="outline" @click="downloadPDF">
            Download as PDF
          </u-button>
        </div>
      </div>
      <div class="flex gap-3 items-end justify-between">
        <div class="flex gap-3 items-end">
          <div class="flex flex-col gap-1 items-center">
            <u-tooltip :content="{ side: 'top' }" :ui="{ text: 'font-bold' }" text="Tsunami">
              <u-button
                class="text-4xl"
                size="lg"
                variant="ghost"
                @click="loadPreset(PRESET_TSUNAMI, [presetTimespans], 'tsunami')"
                >🌊</u-button
              >
            </u-tooltip>
            <span class="text-xs font-medium text-gray-600">Tsunami</span>
          </div>
          <div class="flex flex-col gap-1 items-center">
            <u-tooltip :content="{ side: 'top' }" :ui="{ text: 'font-bold' }" text="Earthquake">
              <u-button
                class="text-4xl"
                size="lg"
                variant="ghost"
                @click="loadPreset(PRESET_EARTHQUAKE, [presetTimespans], 'earthquake')"
                >🌍</u-button
              >
            </u-tooltip>
            <span class="text-xs font-medium text-gray-600">Earthquake</span>
          </div>
          <div class="flex flex-col gap-1 items-center">
            <u-tooltip :content="{ side: 'top' }" :ui="{ text: 'font-bold' }" text="Eruption">
              <u-button
                class="text-4xl"
                size="lg"
                variant="ghost"
                @click="loadPreset(PRESET_VOLCANO, [presetTimespans], 'volcano')"
                >🌋</u-button
              >
            </u-tooltip>
            <span class="text-xs font-medium text-gray-600">Eruption</span>
          </div>
          <div class="flex flex-col gap-1 items-center">
            <u-tooltip
              :content="{ side: 'top' }"
              :ui="{ text: 'font-bold' }"
              text="Marine Heatwave"
            >
              <u-button
                class="text-4xl"
                size="lg"
                variant="ghost"
                @click="loadPreset(PRESET_MARINE_HEATWAVE, [presetTimespans], 'marine-heatwave')"
                >🌡️</u-button
              >
            </u-tooltip>
            <span class="text-xs font-medium text-gray-600">Marine Heatwave</span>
          </div>
          <div class="flex flex-col gap-1 items-center">
            <span class="text-gray-400 text-xs">Timespan</span>
            <u-select-menu
              v-model="presetTimespans"
              class="text-xs w-24"
              :items="timeSpans"
              value-key="key"
            />
          </div>
          <div class="flex flex-col gap-1 items-center">
            <span class="text-gray-400 text-xs">Range</span>
            <u-select-menu
              v-model="globalRange"
              class="text-xs w-24"
              :items="ranges"
              value-key="key"
            />
          </div>
          <div class="flex flex-col gap-1 items-center">
            <span class="text-gray-400 text-xs">UTC Date</span>
            <u-popover>
              <u-button icon="i-lucide-calendar" size="sm" variant="outline" class="text-xs w-28">
                {{ eventDate || 'Pick date' }}
              </u-button>
              <template #content>
                <u-calendar v-model="calendarDate" />
              </template>
            </u-popover>
          </div>
          <div class="flex flex-col gap-1 items-center">
            <span class="text-gray-400 text-xs">Event Name</span>
            <input
              v-model="eventName"
              class="border border-gray-300 px-2 py-1 rounded text-xs w-44"
              placeholder="e.g. axial_2015"
              type="text"
            />
          </div>
        </div>
        <p class="max-w-sm pb-1 text-right text-sm text-gray-800">
          Click an event emoji to load a preset collection of plots. Set a UTC date to populate
          acoustic instrument panels.
        </p>
      </div>
    </div>

    <div class="bg-gray-200 h-px mb-6 no-print" />

    <div v-if="isLoading" class="no-print py-8 text-center text-gray-500">Loading plot list…</div>

    <!-- Panels -->
    <div v-for="(panel, i) in panels" :key="i" class="mb-10 panel">
      <!-- Controls row (hidden when printing) -->
      <div class="flex flex-wrap gap-3 items-center mb-4 no-print">
        <u-select-menu
          v-model="panel.instrument"
          class="min-w-72"
          :items="instruments.map((inst) => ({ label: inst.label, value: inst.key }))"
          placeholder="Select instrument…"
          value-key="value"
          @update:model-value="panel.parameter = ''"
        />
        <u-select-menu
          v-model="panel.timespan"
          class="min-w-36"
          :items="timeSpans.map((t) => ({ label: t.label, value: t.key }))"
          placeholder="Time span…"
          value-key="value"
        />
        <u-select-menu
          v-model="panel.range"
          class="min-w-32"
          :items="ranges.map((r) => ({ label: r.label, value: r.key }))"
          placeholder="Range…"
          value-key="value"
        />
        <u-select-menu
          v-model="panel.parameter"
          class="min-w-48"
          :items="
            getParametersForInstrument(panel.instrument).map((p) => ({
              label: p.label,
              value: p.key,
            }))
          "
          placeholder="Parameter…"
          value-key="value"
        />
        <u-select-menu
          v-model="panel.overlay"
          class="min-w-36"
          :items="overlays.map((o) => ({ label: o.label, value: o.key }))"
          placeholder="Overlay…"
          value-key="value"
        />
        <u-button
          v-if="panels.length > 1"
          color="error"
          icon="i-lucide-trash-2"
          variant="ghost"
          @click="removePanel(i)"
        />
      </div>

      <!-- Print-only label -->
      <div v-if="panel.instrument" class="mb-2 print-only">
        <p class="font-semibold text-sm">
          {{ instrumentLabel(panel.instrument) }} — {{ timespanLabel(panel.timespan)
          }}<template v-if="panel.parameter"> — {{ panel.parameter }}</template>
        </p>
        <hr class="my-2" />
      </div>

      <!-- Images -->
      <template v-if="panel.instrument">
        <template v-if="hasVisibleImages(panel)">
          <img
            v-for="url in getMatchingPlots(panel)"
            :key="url"
            alt="Plot"
            class="h-auto max-w-full mb-4 rounded"
            loading="lazy"
            :src="url"
            @error="imageLoadErrors.push(url)"
          />
        </template>
        <div v-else class="bg-gray-100 no-print p-6 rounded text-center text-gray-500">
          No images found for this selection.
        </div>
      </template>
      <div
        v-else
        :class="[
          'bg-gray-50 border border-dashed border-gray-300 no-print p-6 rounded text-center',
          'text-gray-400',
        ]"
      >
        Select instrument and parameters to load images.
      </div>

      <!-- Description -->
      <div class="mt-2">
        <button
          class="flex gap-1 hover:text-gray-700 items-center no-print text-gray-500 text-sm"
          @click="panel.descriptionOpen = !panel.descriptionOpen"
        >
          <u-icon
            :name="panel.descriptionOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          />
          Notes
        </button>
        <textarea
          v-if="panel.descriptionOpen"
          v-model="panel.description"
          class="border border-gray-300 mt-2 no-print p-2 rounded text-sm w-full"
          placeholder="Add notes or description for this panel…"
          rows="3"
        />
        <p v-if="panel.description" class="mt-1 print-only text-gray-700 text-sm">
          {{ panel.description }}
        </p>
      </div>
    </div>

    <!-- Add panel button (hidden when printing) -->
    <div class="mt-2 no-print">
      <u-button icon="i-lucide-plus" variant="outline" @click="addPanel">
        Add Image Selection
      </u-button>
    </div>
  </div>
</template>

<style scoped>
.print-only {
  display: none;
}

@media print {
  .no-print {
    display: none !important;
  }

  .print-only {
    display: block;
  }

  .panel {
    page-break-inside: avoid;
  }

  img {
    max-width: 100%;
    page-break-inside: avoid;
  }

  .image-report-root {
    padding: 0;
  }
}
</style>
