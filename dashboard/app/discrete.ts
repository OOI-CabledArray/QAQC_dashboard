import { parse } from 'papaparse'
import { defineStore } from 'pinia'

type RawSample = Record<string, string>
type Sample = Record<string, SampleValue>
type SampleValue = string | number | null
type SampleValueType = 'text' | 'number'

type SampleSchema = Record<string, SampleSchemaFieldDefinition>
type SampleSchemaFieldDefinition = {
  type: SampleValueType
}

type CsvFile = {
  name: string
  content: string
}

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
  const samples = [...raw] as Sample[]

  for (const sample of samples) {
    for (const [name, value] of Object.entries(sample)) {
      const field = schema[name]
      if (field == null) {
        continue
      }

      sample[name] = convertValue(value as string, field)
    }
  }

  return [samples, schema]
}

function inferSchema(raw: RawSample[]): SampleSchema {
  const schema: SampleSchema = {}

  for (const sample of raw) {
    for (const [name, value] of Object.entries(sample)) {
      const type = inferValueType(value)
      if (type === 'text' || (type === 'number' && !(name in schema))) {
        if (schema[name]?.type !== type) {
          schema[name] = { type }
        }
      }
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
  }

  return raw
}
