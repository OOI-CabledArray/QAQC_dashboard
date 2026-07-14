<script lang="ts" setup>
import { parseDate, type CalendarDate } from '@internationalized/date'
import { useDebounceFn } from '@vueuse/core'
import JSZip from 'jszip'
import pkg from 'papaparse'
import { computed, onMounted, watch } from 'vue'

import {
  acousticImagePath,
  echogramsURL,
  isAcoustic,
  isEchosounder,
  sensorId,
  spectrogramsURL,
} from '~/instruments'
import { parsePlotFilename } from '~/plotFilename'
import { useStore } from '~/store'

const { parse } = pkg

const store = useStore()

// prettier-ignore
const SITES_CSV_URL = 'https://raw.githubusercontent.com/OOI-CabledArray/rca-data-tools/main/rca_data_tools/qaqc/params/sitesDictionary.csv'
// prettier-ignore
const VARIABLE_MAP_URL = 'https://raw.githubusercontent.com/OOI-CabledArray/rca-data-tools/main/rca_data_tools/qaqc/params/variableMap.csv'
// prettier-ignore
const EVENT_PRESETS_URL = 'https://raw.githubusercontent.com/OOI-CabledArray/rca-data-tools/main/rca_data_tools/qaqc/params/eventPresets.csv'

let instruments = $ref<{ key: string; label: string }[]>([])
let parameters = $ref<{ key: string; label: string }[]>([])

// refDes -> list of variableNames from sitesDictionary.dataParameters
const instrumentParams = new Map<string, string[]>()
// parameter key -> list of variableNames from variableMap
const parameterVariables = new Map<string, string[]>()

/** Parse a params CSV into header-keyed row objects. */
function parseCSV(text: string): Record<string, string>[] {
  return parse<Record<string, string>>(text, { header: true, skipEmptyLines: true }).data
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
// Loaded from rca-data-tools params/eventPresets.csv (preset,refDes,parameter,overlay)
// so instrument collections can be updated without a dashboard deploy.
type PresetEntry = Partial<Omit<Panel, 'description' | 'descriptionOpen'>> & { instrument: string }

const presets = $ref<Record<string, PresetEntry[]>>({})
// Per-preset default timespan (falls back to 'week'). Heatwaves persist for
// months, so a longer default is more informative against the clim overlay.
const presetDefaultTimespan: Record<string, string> = { 'marine-heatwave': 'month' }
// ─────────────────────────────────────────────────────────────────────────────
let presetTimespans = $ref<string>('week')
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

// Memoized once per panels/plotList change instead of re-derived on every
// template read — getMatchingPlots scans the full plot list, and the template
// reads it several times per panel (image list, empty-state check, freshness).
const matchedPlotsByPanel = $computed(() => panels.map((panel) => getMatchingPlots(panel)))

const totalPlotCount = computed(() =>
  matchedPlotsByPanel.reduce((sum, urls) => sum + urls.length, 0),
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

function getAcousticUrl(instrument: string): string | null {
  if (!eventDate) return null
  const id = sensorId(instrument)
  const base = isEchosounder(id) ? echogramsURL : spectrogramsURL
  return acousticImagePath(base, id, eventDate.replace(/-/g, ''))
}

function hasVisibleImages(urls: string[] | undefined): boolean {
  return !!urls && urls.length > 0 && urls.some((u) => !imageLoadErrors.includes(u))
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
        instruments = parseCSV(text).flatMap((cols) => {
          const refDes = cols.refDes?.trim()
          if (!refDes) return []
          const vars = stripQuotes(cols.dataParameters?.trim() ?? '')
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
        parameters = parseCSV(text).flatMap((cols) => {
          const param = cols.parameter?.trim()
          if (!param) return []
          const vars = stripQuotes(cols.variableNames?.trim() ?? '')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
          parameterVariables.set(param, vars)
          return [{ key: param, label: param }]
        })
      }),
    fetch(EVENT_PRESETS_URL)
      .then((r) => r.text())
      .then((text) => {
        for (const cols of parseCSV(text)) {
          const preset = cols.preset?.trim()
          const instrument = cols.refDes?.trim()
          if (!preset || !instrument) continue
          ;(presets[preset] ??= []).push({
            instrument,
            parameter: cols.parameter?.trim() ?? '',
            overlay: (cols.overlay?.trim() as Panel['overlay']) || 'none',
          })
        }
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
      if (!plot.endsWith('.png')) return false
      const info = parsePlotFilename(plot)
      if (!info) return false
      if (info.ref !== panel.instrument) return false
      if (info.timeSpan !== panel.timespan) return false
      if (info.dataRange !== panel.range) return false
      if (info.depthString.endsWith('meters')) return false
      // "Profile" overlay selects the raw (unannotated) plot at the profile marker depth.
      const isProfilePlot = info.depthString.endsWith('profile')
      if (isProfilePlot && panel.overlay !== 'profile') return false
      if (panel.overlay === 'profile' && info.overlays !== 'none') return false
      if (panel.parameter && info.variable !== panel.parameter) return false
      if (panel.overlay && panel.overlay !== 'profile' && info.overlays !== panel.overlay) {
        return false
      }
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

function selectPreset(name: string) {
  presetTimespans = presetDefaultTimespan[name] ?? 'week'
  loadPreset(presets[name] ?? [], [presetTimespans], name)
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
        <h1 class="font-bold sm:text-4xl text-3xl text-highlighted">Event Report</h1>
        <div class="flex gap-2">
          <u-button
            color="neutral"
            icon="i-lucide-rotate-ccw"
            size="lg"
            variant="outline"
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
            @click="
              () => {
                showDownloadConfirm = true
              }
            "
          >
            Download Images
          </u-button>
          <u-button
            v-else
            color="error"
            icon="i-lucide-x"
            size="lg"
            variant="outline"
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
                <p class="text-gray-700 text-sm">
                  Download {{ totalPlotCount }} plot{{ totalPlotCount === 1 ? '' : 's' }}
                  as a ZIP file? This may take a moment.
                </p>
                <template #footer>
                  <div class="flex gap-2 justify-end">
                    <u-button
                      variant="ghost"
                      @click="
                        () => {
                          showDownloadConfirm = false
                        }
                      "
                      >Cancel</u-button
                    >
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
            <u-tooltip :content="{ side: 'top' }" text="Tsunami" :ui="{ text: 'font-bold' }">
              <u-button class="text-4xl" size="lg" variant="ghost" @click="selectPreset('tsunami')"
                >🌊</u-button
              >
            </u-tooltip>
            <span class="font-medium text-gray-600 text-xs">Tsunami</span>
          </div>
          <div class="flex flex-col gap-1 items-center">
            <u-tooltip :content="{ side: 'top' }" text="Earthquake" :ui="{ text: 'font-bold' }">
              <u-button
                class="text-4xl"
                size="lg"
                variant="ghost"
                @click="selectPreset('earthquake')"
                >🌍</u-button
              >
            </u-tooltip>
            <span class="font-medium text-gray-600 text-xs">Earthquake</span>
          </div>
          <div class="flex flex-col gap-1 items-center">
            <u-tooltip :content="{ side: 'top' }" text="Eruption" :ui="{ text: 'font-bold' }">
              <u-button class="text-4xl" size="lg" variant="ghost" @click="selectPreset('volcano')"
                >🌋</u-button
              >
            </u-tooltip>
            <span class="font-medium text-gray-600 text-xs">Eruption</span>
          </div>
          <div class="flex flex-col gap-1 items-center">
            <u-tooltip
              :content="{ side: 'top' }"
              text="Marine Heatwave"
              :ui="{ text: 'font-bold' }"
            >
              <u-button
                class="text-4xl"
                size="lg"
                variant="ghost"
                @click="selectPreset('marine-heatwave')"
                >🌡️</u-button
              >
            </u-tooltip>
            <span class="font-medium text-gray-600 text-xs">Marine Heatwave</span>
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
              <u-button class="text-xs w-28" icon="i-lucide-calendar" size="sm" variant="outline">
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
        <p class="max-w-sm pb-1 text-gray-800 text-right text-sm">
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
        <template v-if="hasVisibleImages(matchedPlotsByPanel[i])">
          <img
            v-for="url in matchedPlotsByPanel[i]"
            :key="url"
            alt="Plot"
            class="h-auto max-w-full mb-4 rounded"
            loading="lazy"
            :src="url"
            @error="imageLoadErrors.push(url)"
          />
        </template>
        <div v-else class="bg-gray-100 no-print p-6 rounded text-center text-gray-500">
          <template v-if="!matchedPlotsByPanel[i]?.length">
            No plots found for this instrument, timespan, and range combination.
          </template>
          <template v-else>
            Plot listed in the index but not currently available — it may not have regenerated yet.
          </template>
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
