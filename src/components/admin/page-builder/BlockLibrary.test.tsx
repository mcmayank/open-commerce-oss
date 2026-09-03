/** @vitest-environment jsdom */
import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { BlockLibrary, labelForBlockType, isBlockLocked } from './BlockLibrary'
import { SelectionProvider, useSelection } from './selection'

const addFieldRow = vi.fn()

let mockRows: Array<{ id: string; blockType?: string }> = []
let mockEntitlements = { premiumSections: false, customCss: false, customSections: false }

vi.mock('@payloadcms/ui', () => ({
  useForm: () => ({ addFieldRow }),
  useFormFields: (selector: (args: [{ layout?: { rows?: typeof mockRows } }]) => unknown) =>
    selector([{ layout: { rows: mockRows } }]),
}))

vi.mock('../PremiumEntitlement/PremiumEntitlementClient', () => ({
  usePremiumEntitlement: () => mockEntitlements,
}))

afterEach(() => {
  cleanup()
  addFieldRow.mockReset()
  mockRows = []
  mockEntitlements = { premiumSections: false, customCss: false, customSections: false }
})

function renderLibrary(onAdd?: () => void) {
  return render(
    <SelectionProvider>
      <BlockLibrary onAdd={onAdd} />
    </SelectionProvider>,
  )
}

/** Selects `rowIdToSelect` via useSelection() before BlockLibrary reads it, so the
 *  "insert after the selected row" path can be exercised end-to-end. */
function SelectAndRender({ rowIdToSelect }: { rowIdToSelect: string }) {
  const { select } = useSelection()
  React.useEffect(() => {
    select(rowIdToSelect)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <BlockLibrary />
}

describe('BlockLibrary', () => {
  it('renders blocks grouped by category', () => {
    renderLibrary()
    // Every curated category with at least one block should render as a group heading.
    expect(screen.getByText('Heroes')).toBeTruthy()
    expect(screen.getByText('Commerce')).toBeTruthy()
    expect(screen.getByText('Content')).toBeTruthy()
    expect(screen.getByText('Social proof')).toBeTruthy()
    expect(screen.getByText('Media & capture')).toBeTruthy()
    expect(screen.getByText('Utility')).toBeTruthy()
    // A representative block from a couple of groups actually renders inside them.
    expect(screen.getByTestId('block-hero')).toBeTruthy()
    expect(screen.getByTestId('block-productGrid')).toBeTruthy()
  })

  it('shows a lock on a premium-gated block and does not add it on click', () => {
    mockEntitlements = { premiumSections: false, customCss: false, customSections: false }
    renderLibrary()
    const splitHeroBtn = screen.getByTestId('block-splitHero') as HTMLButtonElement
    expect(splitHeroBtn.querySelector('.nb-pb-library__lock')).toBeTruthy()
    expect(splitHeroBtn.disabled).toBe(true)
    fireEvent.click(splitHeroBtn)
    expect(addFieldRow).not.toHaveBeenCalled()
  })

  it('unlocks the premium block once the entitlement is granted', () => {
    mockEntitlements = { premiumSections: true, customCss: false, customSections: false }
    renderLibrary()
    const splitHeroBtn = screen.getByTestId('block-splitHero') as HTMLButtonElement
    expect(splitHeroBtn.querySelector('.nb-pb-library__lock')).toBeNull()
    expect(splitHeroBtn.disabled).toBe(false)
  })

  it('locks the customSection block on the customSections entitlement, independent of premiumSections', () => {
    mockEntitlements = { premiumSections: true, customCss: true, customSections: false }
    renderLibrary()
    const customSectionBtn = screen.getByTestId('block-customSection') as HTMLButtonElement
    expect(customSectionBtn.disabled).toBe(true)
  })

  it('calls addFieldRow with path/blockType for an available block, appending at the end when nothing is selected', () => {
    mockRows = [{ id: 'row-a', blockType: 'hero' }]
    renderLibrary()
    fireEvent.click(screen.getByTestId('block-productGrid'))
    expect(addFieldRow).toHaveBeenCalledTimes(1)
    const call = addFieldRow.mock.calls[0][0]
    expect(call).toMatchObject({ path: 'layout', blockType: 'productGrid', rowIndex: 1 })
  })

  it('inserts after the selected row rather than at the end', () => {
    mockRows = [
      { id: 'row-a', blockType: 'hero' },
      { id: 'row-b', blockType: 'faq' },
      { id: 'row-c', blockType: 'richText' },
    ]
    render(
      <SelectionProvider>
        <SelectAndRender rowIdToSelect="row-a" />
      </SelectionProvider>,
    )
    fireEvent.click(screen.getByTestId('block-productGrid'))
    expect(addFieldRow).toHaveBeenCalledTimes(1)
    const call = addFieldRow.mock.calls[0][0]
    // row-a is index 0 -> new block inserts at index 1, ahead of the existing rows after it.
    expect(call).toMatchObject({ path: 'layout', blockType: 'productGrid', rowIndex: 1 })
  })

  it('calls onAdd after successfully adding a block', () => {
    const onAdd = vi.fn()
    renderLibrary(onAdd)
    fireEvent.click(screen.getByTestId('block-hero'))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('does not call onAdd when clicking a locked block', () => {
    mockEntitlements = { premiumSections: false, customCss: false, customSections: false }
    const onAdd = vi.fn()
    renderLibrary(onAdd)
    fireEvent.click(screen.getByTestId('block-splitHero'))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('uses the rowIndex prop over the selected-row fallback', () => {
    mockRows = [
      { id: 'row-a', blockType: 'hero' },
      { id: 'row-b', blockType: 'faq' },
    ]
    function SelectRowBThenRenderAtIndex0() {
      const { select } = useSelection()
      React.useEffect(() => {
        select('row-b')
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      // Selecting row-b (index 1) would normally insert at 2; passing
      // rowIndex explicitly must override that.
      return <BlockLibrary rowIndex={0} />
    }
    render(
      <SelectionProvider>
        <SelectRowBThenRenderAtIndex0 />
      </SelectionProvider>,
    )
    fireEvent.click(screen.getByTestId('block-productGrid'))
    expect(addFieldRow).toHaveBeenCalledTimes(1)
    expect(addFieldRow.mock.calls[0][0]).toMatchObject({ path: 'layout', blockType: 'productGrid', rowIndex: 0 })
  })

  it('adds a block with no useDocumentInfo/collectionSlug in scope at all', () => {
    // Task 8 dropped this component's `useDocumentInfo()` call — see its
    // docblock for why `collectionSlug` was dead weight. This test's
    // `@payloadcms/ui` mock (above) has no `useDocumentInfo` export at all,
    // so simply rendering and adding a block here proves the component
    // doesn't call it — a reintroduction would throw before this assertion
    // ever ran.
    mockRows = [{ id: 'row-a', blockType: 'hero' }]
    renderLibrary()
    fireEvent.click(screen.getByTestId('block-productGrid'))
    expect(addFieldRow).toHaveBeenCalledTimes(1)
    expect(addFieldRow.mock.calls[0][0]).toMatchObject({ path: 'layout', blockType: 'productGrid', rowIndex: 1 })
  })
})

describe('labelForBlockType', () => {
  it('uses the registered label when a block declares one', () => {
    expect(labelForBlockType('splitHero')).toBe('Split Hero (legacy — use Hero)')
  })

  it('humanizes the camelCase slug for blocks that declare no label', () => {
    expect(labelForBlockType('imageGallery')).toBe('Image Gallery')
    expect(labelForBlockType('hero')).toBe('Hero')
  })

  it('keeps a known initialism upper-cased rather than title-casing it', () => {
    expect(labelForBlockType('faq')).toBe('FAQ')
  })

  it('falls back to a generic label for a missing block type, and humanizes an unregistered slug', () => {
    expect(labelForBlockType(undefined)).toBe('Block')
    expect(labelForBlockType('someOtherBlock')).toBe('Some Other Block')
  })
})

describe('isBlockLocked', () => {
  it('locks a premium block when premiumSections is not entitled', () => {
    expect(isBlockLocked('splitHero', { premiumSections: false, customSections: false })).toBe(true)
    expect(isBlockLocked('splitHero', { premiumSections: true, customSections: false })).toBe(false)
  })

  it('locks the customSection block on customSections independent of premiumSections', () => {
    expect(isBlockLocked('customSection', { premiumSections: true, customSections: false })).toBe(true)
    expect(isBlockLocked('customSection', { premiumSections: true, customSections: true })).toBe(false)
  })

  it('never locks a missing block type', () => {
    expect(isBlockLocked(undefined, { premiumSections: false, customSections: false })).toBe(false)
  })
})
