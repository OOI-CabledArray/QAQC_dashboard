<script lang="ts" setup>
import { onMounted } from 'vue'

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

/** Strip a single layer of surrounding double-quotes if present (artifact of triple-quoting in CSV). */
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
  overlay: string
  parameter: string
  description: string
  descriptionOpen: boolean
}

// ── Presets ───────────────────────────────────────────────────────────────────
type PresetEntry = Partial<Omit<Panel, 'description' | 'descriptionOpen'>> & { instrument: string }

const PRESET_TSUNAMI: PresetEntry[] = [
  {
    instrument: 'RS03INT2-MJ03D-11-CTDPFB307',
    parameter: 'temperature',
    overlay: 'none',
    timespan: 'week',
  },
  {
    instrument: 'RS01SBPS-PC01A-4A-CTDPFA103',
    parameter: 'temperature',
    overlay: 'none',
    timespan: 'week',
  },
  {
    instrument: 'CE04OSPS-PC01B-4A-CTDPFA109',
    parameter: 'temperature',
    overlay: 'none',
    timespan: 'week',
  },
]

const PRESET_EARTHQUAKE: PresetEntry[] = [
  {
    instrument: 'RS03CCAL-MJ03F-05-BOTPTA301',
    parameter: 'seafloor_uplift_10m',
    overlay: 'none',
    timespan: 'week',
  },
  {
    instrument: 'RS03ASHS-MJ03B-09-BOTPTA304',
    parameter: 'seafloor_uplift_10m',
    overlay: 'none',
    timespan: 'week',
  },
]

const PRESET_VOLCANO: PresetEntry[] = [
  {
    instrument: 'RS03ASHS-MJ03B-10-CTDPFB304',
    parameter: 'temperature',
    overlay: 'none',
    timespan: 'week',
  },
  {
    instrument: 'RS03CCAL-MJ03F-12-CTDPFB305',
    parameter: 'temperature',
    overlay: 'none',
    timespan: 'week',
  },
  {
    instrument: 'RS03ECAL-MJ03E-12-CTDPFB306',
    parameter: 'temperature',
    overlay: 'none',
    timespan: 'week',
  },
]
const PRESET_MARINE_HEATWAVE: PresetEntry[] = [
  {
    instrument: 'CE02SHBP-LJ01D-06-CTDBPN106',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
  {
    instrument: 'CE04OSBP-LJ01C-06-CTDBPO108',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
  {
    instrument: 'RS01SLBS-LJ01A-12-CTDPFB101',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
  {
    instrument: 'RS03AXBS-LJ03A-12-CTDPFB301',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
  {
    instrument: 'RS03ASHS-MJ03B-10-CTDPFB304',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
  {
    instrument: 'RS03CCAL-MJ03F-12-CTDPFB305',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
  {
    instrument: 'RS03ECAL-MJ03E-12-CTDPFB306',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
  {
    instrument: 'RS03INT2-MJ03D-11-CTDPFB307',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
  {
    instrument: 'RS01SBPS-PC01A-4A-CTDPFA103',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
  {
    instrument: 'CE04OSPS-PC01B-4A-CTDPFA109',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
  {
    instrument: 'RS03AXPS-PC03A-4A-CTDPFA303',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
  {
    instrument: 'RS01SBPS-SF01A-2A-CTDPFA102',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
  {
    instrument: 'CE04OSPS-SF01B-2A-CTDPFA107',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
  {
    instrument: 'RS03AXPS-SF03A-2A-CTDPFA302',
    parameter: 'temperature',
    overlay: 'clim',
    timespan: 'month',
  },
]
// ─────────────────────────────────────────────────────────────────────────────

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
  { key: 'time', label: 'Time' },
  { key: 'clim', label: 'Climatology' },
]

const panels = $ref<Panel[]>([
  {
    instrument: '',
    timespan: 'week',
    overlay: 'none',
    parameter: '',
    description: '',
    descriptionOpen: false,
  },
])
let isLoading = $ref(false)

onMounted(async () => {
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
  if (!panel.instrument || !panel.timespan) return []
  return store.plotList
    .filter((plot) => {
      if (
        !plot.includes(panel.instrument) ||
        !plot.includes(panel.timespan) ||
        !plot.includes('full') ||
        !plot.endsWith('.png')
      )
        return false
      if (plot.includes('meters')) return false
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

function loadPreset(preset: PresetEntry[]) {
  panels.splice(
    0,
    panels.length,
    ...preset.map((entry) => ({
      instrument: entry.instrument,
      timespan: entry.timespan ?? 'week',
      overlay: entry.overlay ?? 'none',
      parameter: entry.parameter ?? '',
      description: '',
      descriptionOpen: false,
    })),
  )
}

function downloadPDF() {
  window.print()
}
</script>

<template>
  <div class="image-report-root p-6">
    <!-- Page header (hidden when printing) -->
    <div class="no-print flex items-center justify-between mb-6">
      <div class="flex items-center gap-2">
        <h1 class="font-bold text-2xl mr-3">Event Report</h1>
        <u-tooltip text="Tsunami preset">
          <u-button variant="ghost" size="lg" class="text-4xl" @click="loadPreset(PRESET_TSUNAMI)"
            >🌊</u-button
          >
        </u-tooltip>
        <u-tooltip text="Earthquake preset">
          <u-button
            variant="ghost"
            size="lg"
            class="text-4xl"
            @click="loadPreset(PRESET_EARTHQUAKE)"
            >🌍</u-button
          >
        </u-tooltip>
        <u-tooltip text="Volcano preset">
          <u-button variant="ghost" size="lg" class="text-4xl" @click="loadPreset(PRESET_VOLCANO)"
            >🌋</u-button
          >
        </u-tooltip>
        <u-tooltip text="Marine heatwave preset">
          <u-button
            variant="ghost"
            size="lg"
            class="text-4xl"
            @click="loadPreset(PRESET_MARINE_HEATWAVE)"
            >🌡️</u-button
          >
        </u-tooltip>
      </div>
      <u-button icon="i-lucide-file-down" size="lg" @click="downloadPDF">
        Download as PDF
      </u-button>
    </div>

    <div v-if="isLoading" class="no-print text-gray-500 py-8 text-center">Loading plot list…</div>

    <!-- Panels -->
    <div v-for="(panel, i) in panels" :key="i" class="panel mb-10">
      <!-- Controls row (hidden when printing) -->
      <div class="no-print flex flex-wrap items-center gap-3 mb-4">
        <u-select-menu
          v-model="panel.instrument"
          :items="instruments.map((inst) => ({ label: inst.label, value: inst.key }))"
          value-key="value"
          class="min-w-72"
          placeholder="Select instrument…"
          @update:model-value="panel.parameter = ''"
        />
        <u-select-menu
          v-model="panel.timespan"
          :items="timeSpans.map((t) => ({ label: t.label, value: t.key }))"
          value-key="value"
          class="min-w-36"
          placeholder="Time span…"
        />
        <u-select-menu
          v-model="panel.parameter"
          :items="
            getParametersForInstrument(panel.instrument).map((p) => ({
              label: p.label,
              value: p.key,
            }))
          "
          value-key="value"
          class="min-w-48"
          placeholder="Parameter…"
        />
        <u-select-menu
          v-model="panel.overlay"
          :items="overlays.map((o) => ({ label: o.label, value: o.key }))"
          value-key="value"
          class="min-w-36"
          placeholder="Overlay…"
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
      <div v-if="panel.instrument && panel.timespan" class="print-only mb-2">
        <p class="font-semibold text-lg">
          {{ instrumentLabel(panel.instrument) }} — {{ timespanLabel(panel.timespan) }}
        </p>
        <hr class="my-2" />
      </div>

      <!-- Images -->
      <template v-if="panel.instrument && panel.timespan">
        <template v-if="getMatchingPlots(panel).length > 0">
          <img
            v-for="url in getMatchingPlots(panel)"
            :key="url"
            :src="url"
            alt="Plot"
            class="h-auto max-w-full mb-4 rounded"
            loading="lazy"
          />
        </template>
        <div v-else class="no-print bg-gray-100 p-6 rounded text-gray-500 text-center">
          No images found for this selection.
        </div>
      </template>
      <div
        v-else
        class="no-print bg-gray-50 border border-dashed border-gray-300 p-6 rounded text-center text-gray-400"
      >
        Select instrument and parameters to load images.
      </div>

      <!-- Description -->
      <div class="mt-2">
        <button
          class="no-print flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
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
          class="no-print mt-2 w-full rounded border border-gray-300 p-2 text-sm"
          rows="3"
          placeholder="Add notes or description for this panel…"
        />
        <p v-if="panel.description" class="print-only text-sm text-gray-700 mt-1">
          {{ panel.description }}
        </p>
      </div>
    </div>

    <!-- Add panel button (hidden when printing) -->
    <div class="no-print mt-2">
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
