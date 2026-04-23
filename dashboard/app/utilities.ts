import { debounce } from 'lodash-es'

export function isSVG(url: string) {
  return url.toLowerCase().endsWith('.svg')
}

export function isPNG(url: string) {
  return url.toLowerCase().endsWith('.png')
}

/** Sleep for the given number of milliseconds, yielding to the event loop. */
export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function debouncedComputed<T>(getter: () => T, delay: number) {
  let value = $ref(getter()) as T

  watch(
    getter,
    debounce((next: T) => {
      value = next
    }, delay),
  )

  return computed(() => value)
}
