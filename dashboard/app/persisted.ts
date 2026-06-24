import { kebabCase, isEqual, camelCase, pick, difference, debounce, isArray } from 'lodash-es'
import type { MaybeRefOrGetter } from 'vue'
import { computed, isReactive, reactive, watch, toValue } from 'vue'
import type { LocationQuery, Router } from 'vue-router'
import type { ZodObject } from 'zod'
import Zod, { ZodArray, ZodBoolean, ZodEnum, ZodNumber, ZodString } from 'zod'

type Mapping = Record<string, any>
export type BaseSchema = ZodObject<any>
export type BaseData<TSchema extends BaseSchema> = Zod.infer<TSchema>

type BasePersistenceMethod<TData extends Mapping> = {
  include?: (keyof TData)[]
  exclude?: (keyof TData)[]
}

export type LocalStoragePersistenceMethod<TData extends Mapping> = {
  type: 'local-storage'
  key: string[] | string
} & BasePersistenceMethod<TData>

export type URLPersistenceMethod<TData extends Mapping> = {
  type: 'url'
  /** Field names to strip from nested objects and arrays before writing to the URL. */
  omit?: string[]
} & BasePersistenceMethod<TData>

export type PersistenceMethod<TData extends Mapping> =
  | LocalStoragePersistenceMethod<TData>
  | URLPersistenceMethod<TData>

export type UsePersistedOptions<TData extends BaseData<TSchema>, TSchema extends BaseSchema> = {
  data?: TData
  schema: TSchema | ((zod: typeof Zod) => TSchema)
  methods: MaybeRefOrGetter<PersistenceMethod<TData>[]>
}

export type KeyInput = string[] | string

function resolveKey(key: KeyInput): string {
  if (Array.isArray(key)) {
    return key.map((part) => part.toString()).join('/')
  }

  return key.toString()
}

export function usePersisted<TData extends BaseData<TSchema>, TSchema extends BaseSchema>(
  options: UsePersistedOptions<TData, TSchema>,
): TData {
  const route = useRoute()
  const router = useRouter()
  const schema = typeof options.schema == 'function' ? options.schema(Zod) : options.schema
  const methods = computed(() => toValue(options.methods))

  let data = (options.data ?? schema.parse({})) as TData
  if (!isReactive(data)) {
    data = reactive(data) as TData
  }

  function read() {
    for (const method of methods.value) {
      let loaded: Partial<TData> | null = null
      if (method.type === 'local-storage') {
        loaded = readFromStorage(resolveKey(method.key), schema)
      } else if (method.type === 'url') {
        loaded = readFromUrl(schema, route.query)
      } else {
        continue
      }

      if (loaded != null) {
        load(data, loaded, method)
      }
    }
  }

  function write() {
    for (const method of methods.value) {
      if (method.type === 'local-storage') {
        writeToStorage(method, data)
      } else if (method.type === 'url') {
        writeToUrl(method, data, schema, router)
      }
    }
  }

  read()
  if (import.meta.client) {
    write()

    watch(
      data,
      debounce(() => {
        write()
      }, 50),
    )
  }

  return data
}

function getFields<TData extends Mapping>(data: TData, method: BasePersistenceMethod<TData>) {
  return difference(method.include ?? Object.keys(data), method.exclude ?? [])
}

function load<TData extends BaseData<TSchema>, TSchema extends BaseSchema>(
  data: TData,
  loaded: Partial<TData>,
  method: BasePersistenceMethod<TData>,
) {
  // Allow extra fields from loaded data.
  const fields = new Set([...getFields(data, method), ...getFields(loaded as any, method)])
  for (const field of fields) {
    if (field in loaded) {
      data[field] = loaded[field] as TData[keyof TData]
    }
  }
}

function readFromStorage<TData extends BaseData<TSchema>, TSchema extends BaseSchema>(
  key: string,
  schema: TSchema,
): Partial<TData> | null {
  const raw = localStorage.getItem(key)
  if (raw == null) {
    return null
  }

  try {
    const json = JSON.parse(raw)
    if (json == null) {
      return null
    }

    return schema.partial().parse(json) as TData
  } catch {
    return null
  }
}

function writeToStorage<TData extends BaseData<TSchema>, TSchema extends BaseSchema>(
  method: LocalStoragePersistenceMethod<TData>,
  data: TData,
) {
  localStorage.setItem(resolveKey(method.key), JSON.stringify(pick(data, getFields(data, method))))
}

function writeToUrl<TData extends BaseData<TSchema>, TSchema extends BaseSchema>(
  method: URLPersistenceMethod<TData>,
  data: TData,
  schema: TSchema,
  router: Router,
) {
  const fields = new Set(getFields(data, method))
  const url = new URL(window.location.href)
  const search = url.searchParams

  const defaults = schema.parse({})
  for (const [field, value] of Object.entries(data)) {
    const key = kebabCase(field)

    if (fields.has(field)) {
      if (isEqual(value, defaults[field])) {
        search.delete(key)
        continue
      }
    } else if (!search.has(key)) {
      search.delete(key)
      continue
    }

    if (isPrimitiveField(schema, field)) {
      search.set(key, String(value))
      continue
    }

    if (isPrimitiveArrayField(schema, field)) {
      if (isArray(value) && value.length > 0) {
        search.set(key, value.join(','))
      }

      continue
    }

    const stripped = method.omit ? stripFields(value, method.omit) : value
    search.set(key, JSON.stringify(stripped))
  }

  const params = url.searchParams.toString()
  const serialized = `${url.pathname}${params ? '?' + params : ''}`.replace(/%2C/g, ',')

  void router.replace(serialized)
}

function readFromUrl<TData extends BaseData<TSchema>, TSchema extends BaseSchema>(
  schema: TSchema,
  query: LocationQuery,
): Partial<TData> | null {
  const data: Record<string, unknown> = {}

  for (const [key, rawValue] of Object.entries(query)) {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
    if (value == null) {
      continue
    }

    const field = camelCase(key)
    if (field in data) {
      continue
    }

    if (value === 'null') {
      data[field] = null
    } else if (isFieldOfType(schema, field, ZodBoolean)) {
      data[field] = Boolean(value)
    } else if (isFieldOfType(schema, field, ZodNumber)) {
      data[field] = Number(value)
    } else if (isPrimitiveField(schema, field)) {
      data[field] = value
    } else if (isArrayFieldOfType(schema, field, ZodBoolean)) {
      data[field] = value.split(',').map(Boolean)
    } else if (isArrayFieldOfType(schema, field, ZodNumber)) {
      data[field] = value.split(',').map(Number)
    } else if (isPrimitiveArrayField(schema, field)) {
      data[field] = value.split(',')
    } else {
      try {
        data[field] = JSON.parse(value)
      } catch {
        data[field] = value
      }
    }
  }

  try {
    return schema.partial().parse(data) as Partial<TData>
  } catch (error) {
    console.error('Failed to parse persisted data.', error)
    return null
  }
}

function isFieldOfType(schema: BaseSchema, field: string, type: any): boolean {
  let current = schema.shape[field]
  while (current != null) {
    if (current instanceof type) {
      return true
    }

    current = current.def?.innerType
  }

  return false
}

function isArrayFieldOfType(schema: BaseSchema, field: string, type: any): boolean {
  let current = schema.shape[field]
  while (current != null) {
    if (current instanceof ZodArray && (current.def.type as any) instanceof type) {
      return true
    }

    current = current.def?.innerType
  }

  return false
}

function isPrimitiveField(schema: BaseSchema, field: string): boolean {
  return (
    isFieldOfType(schema, field, ZodBoolean) ||
    isFieldOfType(schema, field, ZodNumber) ||
    isFieldOfType(schema, field, ZodString) ||
    isFieldOfType(schema, field, ZodEnum)
  )
}

/** Strip the given field names from all objects nested within a value. */
function stripFields(value: unknown, fields: string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripFields(item, fields))
  }

  if (value != null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(value)) {
      if (!fields.includes(key)) {
        result[key] = stripFields(inner, fields)
      }
    }
    return result
  }

  return value
}

function isPrimitiveArrayField(schema: BaseSchema, field: string): boolean {
  return (
    isArrayFieldOfType(schema, field, ZodBoolean) ||
    isArrayFieldOfType(schema, field, ZodNumber) ||
    isArrayFieldOfType(schema, field, ZodString) ||
    isArrayFieldOfType(schema, field, ZodEnum)
  )
}
