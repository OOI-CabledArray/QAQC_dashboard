<script lang="ts" setup>
import { computed } from 'vue'

/**
 * Data-availability bar aligned to a date slider — the buffered-ranges pattern
 * from video scrubbers, applied to "which days have an image".
 *
 * Three states, because a missing image means different work depending on
 * whether the source recording still exists:
 *   present     — image published
 *   recoverable — no image, but raw data is on the archive (re-run the pipeline)
 *   absent      — no image and no raw data (nothing was recorded)
 */
const {
  images,
  raw,
  days,
  rawLoaded = false,
  label = (day: number) => String(day),
} = defineProps<{
  /** Day-of-year numbers that have a published image. */
  images: number[]
  /** Day-of-year numbers the raw archive still holds. */
  raw: number[]
  /** Length of the year, so the rail matches the slider's domain exactly. */
  days: number
  /**
   * Whether the raw archive could answer for this instrument. False while the
   * lookup is pending, and for instruments it does not cover (low-frequency
   * hydrophones come from IRIS) — gaps then read "unknown", not "not recorded".
   */
  rawLoaded?: boolean
  /** Formats a day-of-year for the tooltip. */
  label?: (day: number) => string
}>()

type State = 'present' | 'recoverable' | 'absent' | 'unknown'
type Span = { state: State; start: number; end: number }

const STATE_CLASS: Record<State, string> = {
  present: 'bg-primary-500',
  // Hatched rather than a second flat colour: distinguishable without relying
  // on hue, and reads as "something is owed here".
  recoverable: '-hatched',
  absent: 'bg-gray-200',
  unknown: 'bg-gray-300',
}

const STATE_TEXT: Record<State, string> = {
  present: 'Published',
  recoverable: 'No image — raw data available to re-run',
  absent: 'No image, no raw data',
  unknown: 'No image — raw archive not checked for this instrument',
}

/** Run-length encode the year, so a dozen spans render instead of 365 slots. */
const spans = computed<Span[]>(() => {
  const hasImage = new Set(images)
  const hasRaw = new Set(raw)

  const stateFor = (day: number): State => {
    if (hasImage.has(day)) return 'present'
    if (!rawLoaded) return 'unknown'
    return hasRaw.has(day) ? 'recoverable' : 'absent'
  }

  const result: Span[] = []
  for (let day = 1; day <= days; day++) {
    const state = stateFor(day)
    const last = result.at(-1)
    if (last && last.state === state) last.end = day
    else result.push({ state, start: day, end: day })
  }
  return result
})

/**
 * A single missing day is ~1.4px at a typical width and would vanish into
 * antialiasing — and a one-day hole is exactly what is worth spotting. Gaps are
 * given a floor width, taken back from the neighbouring published runs. The bar
 * is an indicator, not a measurement, so the slight non-linearity is deliberate.
 */
const MIN_GAP_PERCENT = 0.9

const sized = computed(() => {
  const natural = spans.value.map((span) => ({
    ...span,
    percent: ((span.end - span.start + 1) / days) * 100,
  }))

  let borrowed = 0
  for (const span of natural) {
    if (span.state === 'present') continue
    const deficit = MIN_GAP_PERCENT - span.percent
    if (deficit > 0) {
      span.percent = MIN_GAP_PERCENT
      borrowed += deficit
    }
  }

  const presentTotal = natural
    .filter((span) => span.state === 'present')
    .reduce((sum, span) => sum + span.percent, 0)

  if (borrowed > 0 && presentTotal > borrowed) {
    const scale = (presentTotal - borrowed) / presentTotal
    for (const span of natural) {
      if (span.state === 'present') span.percent *= scale
    }
  }
  return natural
})

function tooltip(span: Span): string {
  const range =
    span.start === span.end
      ? label(span.start)
      : `${label(span.start)} – ${label(span.end)} (${span.end - span.start + 1} days)`
  return `${range}\n${STATE_TEXT[span.state]}`
}

const summary = computed(() => {
  const published = images.filter((day) => day <= days).length
  const missing = days - published
  const base = `${published} of ${days} days published.`
  if (missing === 0) return `All ${days} days published.`
  if (!rawLoaded) return `${base} ${missing} missing — raw archive not checked.`
  const recoverable = sized.value
    .filter((span) => span.state === 'recoverable')
    .reduce((sum, span) => sum + (span.end - span.start + 1), 0)
  const notRecorded = missing - recoverable
  return `${base} ${missing} missing — ${recoverable} re-runnable, ${notRecorded} not recorded.`
})
</script>

<template>
  <div class="mt-1">
    <div
      :aria-label="summary"
      class="flex h-1.5 overflow-hidden rounded-sm w-full"
      role="img"
      :title="summary"
    >
      <div
        v-for="(span, i) in sized"
        :key="i"
        :class="STATE_CLASS[span.state]"
        :style="{ width: `${span.percent}%` }"
        :title="tooltip(span)"
      />
    </div>
    <p class="mt-0.5 text-[10px] text-gray-400">{{ summary }}</p>
  </div>
</template>

<style scoped>
/* Diagonal hatch keeps "re-runnable" distinct without depending on hue. */
.-hatched {
  background-color: #fde68a;
  background-image: repeating-linear-gradient(45deg, transparent 0 2px, rgb(0 0 0 / 0.28) 2px 4px);
}
</style>
