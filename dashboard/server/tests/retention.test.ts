import { describe, it, expect } from 'vitest'
import { findArchivesToDelete } from '../utils/archive'

type ArchiveRow = {
  id: string
  date: string
  slug: string
  trigger_type: 'scheduled' | 'manual'
  name: string | null
}

describe('retention policy', () => {
  it('should keep all archives under 30 days old', () => {
    const now = new Date('2026-04-23')
    const archives: ArchiveRow[] = [
      { id: 'aaa', date: '2026-04-22', slug: 'auto', trigger_type: 'scheduled', name: null },
      { id: 'bbb', date: '2026-04-01', slug: 'auto', trigger_type: 'scheduled', name: null },
    ]
    expect(findArchivesToDelete(archives, now)).toEqual([])
  })

  it('should thin 30-180 day archives to Sundays only', () => {
    const now = new Date('2026-06-01')
    const archives: ArchiveRow[] = [
      // 2026-04-19 is a Sunday — keep
      { id: 'aaa', date: '2026-04-19', slug: 'auto', trigger_type: 'scheduled', name: null },
      // 2026-04-20 is a Monday — delete
      { id: 'bbb', date: '2026-04-20', slug: 'auto', trigger_type: 'scheduled', name: null },
      // Manual archive — always keep
      { id: 'ccc', date: '2026-04-20', slug: 'event', trigger_type: 'manual', name: 'Event' },
    ]
    expect(findArchivesToDelete(archives, now)).toEqual(['bbb'])
  })

  it('should thin 180+ day archives to 1st of month only', () => {
    const now = new Date('2026-12-01')
    const archives: ArchiveRow[] = [
      // 2026-05-01 — keep (1st of month)
      { id: 'aaa', date: '2026-05-01', slug: 'auto', trigger_type: 'scheduled', name: null },
      // 2026-05-04 is a Sunday — but >180 days, only 1st of month kept
      { id: 'bbb', date: '2026-05-04', slug: 'auto', trigger_type: 'scheduled', name: null },
      // Manual — always keep
      { id: 'ccc', date: '2026-05-15', slug: 'event', trigger_type: 'manual', name: 'Event' },
    ]
    expect(findArchivesToDelete(archives, now)).toEqual(['bbb'])
  })
})
