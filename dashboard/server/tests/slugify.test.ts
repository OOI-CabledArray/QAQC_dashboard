import { describe, it, expect } from 'vitest'

import { slugify } from '#server/utils/slugify'

describe('slugify', () => {
  it('should convert a name to a URL-safe slug', () => {
    expect(slugify('Axial Seamount M4.2')).toBe('axial-seamount-m4-2')
  })

  it('should collapse multiple dashes', () => {
    expect(slugify('hello -- world')).toBe('hello-world')
  })

  it('should trim leading and trailing dashes', () => {
    expect(slugify('--hello--')).toBe('hello')
  })

  it('should handle empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('should strip special characters', () => {
    expect(slugify('Earthquake! (Large) #5')).toBe('earthquake-large-5')
  })
})
