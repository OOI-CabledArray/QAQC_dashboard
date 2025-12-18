import { uniq } from 'lodash-es'
import { parse } from 'papaparse'
import { defineStore } from 'pinia'

type RawSample = Record<string, string>

export const fields = {
  cruise: 'Cruise',
  station: 'Station',
  asset: 'Target Asset',
  time: 'Start Time [UTC]',
} as const

export type SampleKnownFields = {
  [fields.cruise]: string
  [fields.station]: string
  [fields.asset]: string
  [fields.time]: string
}

export type Sample = SampleKnownFields & Record<string, SampleValue>
export type SampleValue = string | number | null
export type SampleValueType = 'text' | 'number' | 'timestamp'

export type SampleSchema = Record<string, SampleSchemaFieldDefinition>
export type SampleSchemaFieldDefinition = {
  type: SampleValueType
}

type CsvFile = {
  name: string
  content: string
}

const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

/** Fill value, converted to `null` when parsing sample values. */
const fill = -9999999

export const useDiscrete = defineStore('discrete', () => {
  // List of CSV file names.
  let index = $shallowRef<string[]>([])
  // Parsed discrete samples.
  let samples = $shallowRef<Sample[]>([])
  // Inferred schema for discrete samples.
  let schema = $shallowRef<SampleSchema>({})

  async function load() {
    console.log('Loading discrete data.')
    const start = performance.now()

    const loadedIndex = await getIndex()
    const loadedRawSamples = await getRawSamples(loadedIndex)
    const [loadedSamples, loadedSchema] = extractSamples(loadedRawSamples)

    const end = performance.now()
    const duration = ((end - start) / 1000).toFixed(2)

    index = loadedIndex
    samples = loadedSamples
    schema = loadedSchema

    console.log(
      `Loaded ${samples.length} discrete samples from ${index.length} files in ${duration}s.`,
    )

    return [...index]
  }

  return {
    load,
    index: computed(() => index),
    samples: computed(() => samples),
    schema: computed(() => schema),
    fields: computed(() => Object.keys(schema)),
    plottableFields: computed(() =>
      Object.entries(schema)
        .filter(([, definition]) => definition.type !== 'text')
        .map(([name]) => name),
    ),
    stations: computed(() => uniq(samples.map((sample) => sample[fields.station])).sort()),
    assets: computed(() => uniq(samples.map((sample) => sample[fields.asset])).sort()),
    cruises: computed(() => uniq(samples.map((sample) => sample[fields.cruise])).sort()),
  }
})

async function getIndex(): Promise<string[]> {
  const response = await fetch('/discrete/index.json')
  const data: string[] = await response.json()
  return data
}

async function getCsvs(index: string[]): Promise<CsvFile[]> {
  return await Promise.all(
    index.map(async (name) => {
      const url = `/discrete/${name}`
      const response = await fetch(url)
      const content = await response.text()
      return { name, content }
    }),
  )
}

async function getRawSamples(index: string[]): Promise<RawSample[]> {
  const csvs = await getCsvs(index)
  return csvs.flatMap((csv) => parseRawSamples(csv))
}

function parseRawSamples(csv: CsvFile): RawSample[] {
  const parsed = parse(csv.content, {
    header: true,
    skipEmptyLines: true,
  })

  return [...parsed.data] as RawSample[]
}

function extractSamples(raw: RawSample[]): [Sample[], SampleSchema] {
  const schema = inferSchema(raw)
  const samples = raw.flatMap((raw) => {
    // If there are multiple assets in this raw sample's asset field, split them into multiple
    // parsed samples for each defined asset.
    const assets = raw[fields.asset]?.split(',')?.map((current) => current.trim())
    if (assets == null) {
      return []
    }

    return assets.map((asset) => {
      const sample = { [fields.asset]: asset } as Sample
      for (const [name, value] of Object.entries(raw)) {
        const field = schema[name]
        if (field == null || name in sample) {
          continue
        }

        sample[name] = convertValue(value as string, field)
      }

      return sample
    })
  })

  return [samples, schema]
}

function inferSchema(raw: RawSample[]): SampleSchema {
  let schema: SampleSchema = {}

  for (const sample of raw) {
    for (const [name, value] of Object.entries(sample)) {
      const type = inferValueType(value)
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
  }

  // Ensure timestamp field is first.
  const timestamp = schema[fields.time]
  if (timestamp != null) {
    delete schema[fields.time]
    schema = {
      [fields.time]: timestamp,
      ...schema,
    }
  }

  return schema
}

function inferValueType(raw: string): SampleValueType | null {
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

function convertValue(raw: string, field: SampleSchemaFieldDefinition): SampleValue {
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
