import { describe, it, expect } from 'vitest'
import { ImportItems } from './ImportItems'
import { ImportJobs } from './ImportJobs'
import { IMPORT_WARNINGS } from '@/imports/core/types'

type AnyField = { name?: string; type?: string; options?: unknown[]; defaultValue?: unknown }

const field = (fields: unknown[], name: string): AnyField =>
  (fields as AnyField[]).find((f) => f.name === name) ?? {}

const values = (f: AnyField): string[] =>
  (f.options ?? []).map((o) => (typeof o === 'string' ? o : (o as { value: string }).value))

describe('ImportItems', () => {
  // If an adapter raises a code the column will not store, the write fails at
  // the worst moment — halfway through a discovery run. Deriving the options
  // from the union is what stops the two lists drifting.
  it('accepts exactly the warning codes an adapter can raise', () => {
    expect(values(field(ImportItems.fields, 'warnings')).sort()).toEqual(
      [...IMPORT_WARNINGS].sort(),
    )
  })

  it('starts an item pending, so nothing is imported without review', () => {
    const status = field(ImportItems.fields, 'status')
    expect(status.defaultValue).toBe('pending')
    expect(values(status)).toContain('selected')
    expect(values(status)).toContain('skipped')
  })

  it('has a claim column, so two ticks cannot process one item twice', () => {
    expect(field(ImportItems.fields, 'claimedAt').type).toBe('date')
  })

  it('is uniquely indexed per job and source id, so re-discovery cannot double-insert', () => {
    const unique = (ImportItems.indexes ?? []).find((i) => i.unique)
    expect(unique?.fields).toEqual(['job', 'externalId'])
  })
})

describe('ImportJobs', () => {
  it('starts in detecting and can reach every terminal state', () => {
    const status = field(ImportJobs.fields, 'status')
    expect(status.defaultValue).toBe('detecting')
    expect(values(status)).toEqual(
      expect.arrayContaining(['ready', 'importing', 'completed', 'failed', 'cancelled']),
    )
  })

  // Getting this wrong makes every price in the catalog 5% wrong, silently and
  // permanently, so "unanswered" has to be distinguishable from "exclusive".
  it('leaves the tax treatment unanswered rather than defaulting it', () => {
    const tax = field(ImportJobs.fields, 'priceTaxTreatment')
    expect(tax.defaultValue).toBeUndefined()
    expect(values(tax)).toEqual(['inclusive', 'exclusive'])
  })
})
