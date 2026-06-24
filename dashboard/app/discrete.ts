import { parseAbsolute, type ZonedDateTime } from '@internationalized/date'
import { orderBy, uniq } from 'lodash-es'
import pkg from 'papaparse'
import { defineStore } from 'pinia'

import { sleep } from '~/utilities'

const { parse } = pkg

type RawSample = Record<string, string>

export const enum KnownSampleFields {
  Station = 'Station',
  Asset = 'Target Asset',
  Timestamp = 'Start Time [UTC]',
  Depth = 'CTD Depth [m]',
}

export type Sample = Readonly<{
  type: SampleType
  station: string
  asset?: string
  timestamp: ZonedDateTime
  data: SampleData
}>

const index = [
  {
    type: 'summary',
    file: 'summary-samples.csv',
  },
  {
    type: 'ctd-cast',
    file: 'ctd-cast-samples.csv',
  },
] as const

export const sampleTypes = index.map((entry) => entry.type)
export type SampleType = (typeof sampleTypes)[number]

export type SampleData = Record<string, SampleValue>
export type SampleValue = string | number | null
export type SampleValueType = 'text' | 'number' | 'timestamp'

export type SampleSchema = Record<string, SampleSchemaFieldDefinition>
export type SampleSchemaFieldDefinition = {
  type: SampleValueType
}

type RawSampleGroup = {
  type: SampleType
  samples: RawSample[]
}

const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

/** Fill value, converted to `null` when parsing sample values. */
const fill = -9999999

export const useDiscrete = defineStore('discrete', () => {
  // Parsed discrete samples.
  let samples = $shallowRef<Sample[]>([])
  // Inferred schema for discrete samples.
  let schema = $shallowRef<SampleSchema>({})
  let loading = $ref(true)

  async function load() {
    console.log('Loading discrete data.')
    try {
      const start = performance.now()

      const groups = await Promise.all(index.map(({ type, file }) => getRawSamples(type, file)))

      const [extractedSamples, extractedSchema] = await extractSamples(groups)

      const end = performance.now()
      const duration = ((end - start) / 1000).toFixed(2)

      samples = extractedSamples
      schema = extractedSchema

      console.log(
        `Loaded ${samples.length} discrete samples from ${index.length} files in ${duration}s.`,
      )
    } finally {
      loading = false
    }
  }

  if (import.meta.client) {
    load()
  }

  const assetsToStation = $computed<Record<string, string>>(() =>
    Object.fromEntries(samples.map((sample) => [sample.asset, sample.station])),
  )

  const stationToAssets = $computed(() => {
    const mapping: Record<string, string[]> = {}
    for (const sample of samples) {
      const station = sample.station
      const asset = sample.asset
      if (asset == null) {
        continue
      }

      const assets = (mapping[station] ??= [])
      if (!assets.includes(asset)) {
        assets.push(asset)
      }
    }

    return mapping
  })

  return {
    load,
    loading: computed(() => loading),
    samples: computed(() => samples),
    schema: computed(() => schema),
    fields: computed(() => Object.keys(schema)),
    plottableFields: computed(() => {
      const fields = Object.entries(schema)
        .filter(([name, definition]) => {
          if (definition.type === 'text') return false
          const lower = name.toLowerCase()
          if (lower.includes('latitude') || lower.includes('longitude')) return false
          return true
        })
        .map(([name]) => name)

      // Preserve original column order, but move "CTD Cast" fields to the end, and
      // "Water Depth [m]" just before them.
      const rank = (field: string) => {
        if (field.startsWith('CTD Cast ')) {
          return 2
        }
        if (field === 'Water Depth [m]') {
          return 1
        }

        return 0
      }
      return fields.sort((left, right) => rank(left) - rank(right))
    }),

    stations: computed(() => uniq(samples.map((sample) => sample.station)).sort()),
    assets: computed(() => uniq(samples.map((sample) => sample.asset)).sort()),
    assetToStation: computed(() => assetsToStation),
    stationToAssets: computed(() => stationToAssets),
  }
})

async function getRawSamples(type: SampleType, file: string): Promise<RawSampleGroup> {
  const url = `/discrete/${file}`
  const response = await fetch(url)
  const content = await response.text()

  const samples = await new Promise<RawSample[]>((resolve) => {
    parse<RawSample>(content, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete(results) {
        resolve(results.data)
      },
    })
  })

  return { type, samples }
}

/** Number of raw samples to process before yielding to the event loop. */
const batchSize = 2500

async function extractSamples(groups: RawSampleGroup[]): Promise<[Sample[], SampleSchema]> {
  const allRaw = groups.flatMap((file) => file.samples)

  // Infer schema from all raw samples across all groups.
  const schema = await inferSchema(allRaw)

  await sleep(0)

  const samples: Sample[] = []
  let processed = 0

  for (const group of groups) {
    for (const raw of group.samples) {
      // If there are multiple values in a raw sample's station or asset field, split them into
      // multiple parsed samples for each defined station/asset.
      const stations =
        raw[KnownSampleFields.Station]?.split(',')?.map((current) => current.trim()) ?? []

      for (let station of stations) {
        const assets =
          raw[KnownSampleFields.Asset]?.split(',')?.map((current) => current.trim()) ?? []
        for (const asset of assets) {
          if (asset === '') {
            continue
          }

          let timestamp: ZonedDateTime
          try {
            timestamp = parseAbsolute(raw[KnownSampleFields.Timestamp] ?? 'unknown', 'UTC')
          } catch {
            continue
          }

          station = station.trim()
          if (station === '') {
            continue
          }

          const data: SampleData = {
            [KnownSampleFields.Station]: station,
            [KnownSampleFields.Asset]: asset,
          }
          for (const [name, value] of Object.entries(raw)) {
            const field = schema[name]
            if (field == null || name in data) {
              continue
            }

            data[name] = parseValue(value as string, field)
          }

          samples.push({ type: group.type, station, asset, timestamp, data })
        }
      }

      processed++
      if (processed % batchSize === 0) {
        await sleep(0)
      }
    }
  }

  await sleep(0)

  const sorted = orderBy(samples, [(sample) => sample.asset, (sample) => sample.timestamp.toDate()])

  await sleep(0)

  // Freeze samples to prevent accidental mutations and improve performance in some cases.
  const frozen = sorted.map((sample) => Object.freeze(sample))
  return [frozen, schema]
}

async function inferSchema(raw: RawSample[]): Promise<SampleSchema> {
  let schema: SampleSchema = {}

  for (let i = 0; i < raw.length; i++) {
    const sample = raw[i]!
    for (const [name, value] of Object.entries(sample)) {
      const type = inferValueType(name, value)
      if (type == null) {
        continue
      }

      // Current field definition.
      const current = schema[name]

      if (type === 'text') {
        // Once a field is inferred as text, it remains text.
        schema[name] = { type }
      } else {
        if (current != null) {
          // If the current type conflicts with the new type, set to text.
          if (current.type !== type) {
            current.type = 'text'
          }
        } else {
          // Otherwise, create a new field definition for this specific type.
          schema[name] = { type }
        }
      }
    }

    if (i % batchSize === 0 && i > 0) {
      await sleep(0)
    }
  }

  // Ensure timestamp field is first.
  const timestamp = schema[KnownSampleFields.Timestamp]
  if (timestamp != null) {
    delete schema[KnownSampleFields.Timestamp]
    schema = {
      [KnownSampleFields.Timestamp]: timestamp,
      ...schema,
    }
  }

  return schema
}

function inferValueType(name: string, raw: string): SampleValueType | null {
  if (name.toLowerCase().includes('flag')) {
    return 'text'
  }

  raw = raw.trim()
  if (raw === '') {
    return null
  }
  const number = Number(raw)
  if (!Number.isNaN(number)) {
    return 'number'
  }

  // If the value looks like an ISO date, treat it as a date value.
  if (timestampRegex.test(raw)) {
    return 'timestamp'
  }

  return 'text'
}

function parseValue(raw: string, field: SampleSchemaFieldDefinition): SampleValue {
  raw = raw.trim()
  if (raw === '') {
    return null
  }

  if (field.type === 'number') {
    const number = Number(raw)
    if (Number.isNaN(number) || number === fill) {
      return null
    }

    return number
  }

  return raw
}
