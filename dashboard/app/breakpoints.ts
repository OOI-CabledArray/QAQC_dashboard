import { breakpointsTailwind, useBreakpoints as useBreakpointsBase } from '@vueuse/core'

export function useBreakpoints() {
  return useBreakpointsBase(breakpointsTailwind)
}
