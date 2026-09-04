/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { BlockContentEditor } from './BlockContentEditor'

type RenderFieldsProps = {
  fields: Array<{ name?: string }>
  parentPath: string
  parentSchemaPath: string
  parentIndexPath: string
  permissions: unknown
}

// Every RenderFields mount records its props here, so the tests can assert the
// exact path contract we hand Payload — the thing that silently breaks
// server-rendered custom components if it is wrong.
let renderFieldsCalls: RenderFieldsProps[] = []

let mockRows: Array<{ id: string; blockType?: string }> = []
let mockSelectedId: string | null = 'a'
const openModal = vi.fn()

const heroClientBlock = {
  slug: 'hero',
  fields: [
    { name: 'variant' },
    { name: 'blockStyle' },
    { name: 'scheme' },
    { name: 'eyebrow' },
    { name: 'heading' },
    { name: 'subheading' },
  ],
}

// Mirrors the REAL client config shape: `layout` is an inline blocks field
// nested inside an unnamed `tabs` field, and `config.blocksMap` is empty
// because PAGE_BLOCKS are not registered at the config root. A mock that
// served the blocks from `blocksMap` would pass here and render an empty
// Content tab in production.
const clientPagesConfig = {
  slug: 'pages',
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'layout', type: 'blocks', blocks: [heroClientBlock] },
          ],
        },
        { label: 'SEO', fields: [{ name: 'meta', type: 'group', fields: [] }] },
      ],
    },
  ],
}

vi.mock('@payloadcms/ui', () => ({
  useFormFields: (selector: (args: [Record<string, unknown>]) => unknown) =>
    selector([{ layout: { rows: mockRows } }]),
  useDocumentInfo: () => ({ collectionSlug: 'pages', docPermissions: { fields: true } }),
  useConfig: () => ({
    config: { blocksMap: {} },
    getEntityConfig: ({ collectionSlug }: { collectionSlug: string }) =>
      collectionSlug === 'pages' ? clientPagesConfig : undefined,
  }),
  RenderFields: (props: RenderFieldsProps) => {
    renderFieldsCalls.push(props)
    return (
      <div data-testid="render-fields">
        {props.fields.map((f) => (
          <span key={f.name} data-testid={`field-${f.name}`} />
        ))}
      </div>
    )
  },
  Drawer: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="drawer" aria-label={title}>
      {children}
    </div>
  ),
  useModal: () => ({ openModal, closeModal: vi.fn() }),
  useDrawerSlug: () => 'nb-content-drawer',
}))

vi.mock('./selection', () => ({
  useSelection: () => ({ selectedId: mockSelectedId, select: vi.fn() }),
}))

afterEach(() => {
  cleanup()
  renderFieldsCalls = []
  openModal.mockReset()
  mockRows = []
  mockSelectedId = 'a'
})

describe('BlockContentEditor', () => {
  it('renders the selected block’s content fields', () => {
    mockRows = [{ id: 'a', blockType: 'hero' }]
    render(<BlockContentEditor />)

    expect(screen.getAllByTestId('render-fields').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('field-heading').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('field-eyebrow').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('field-subheading').length).toBeGreaterThan(0)
  })

  it('omits the fields the Style tab already owns, so nothing is editable in two places', () => {
    mockRows = [{ id: 'a', blockType: 'hero' }]
    render(<BlockContentEditor />)

    expect(screen.queryByTestId('field-variant')).toBeNull()
    expect(screen.queryByTestId('field-scheme')).toBeNull()
    expect(screen.queryByTestId('field-blockStyle')).toBeNull()
  })

  it('hands Payload the row-scoped path and the block-scoped schema path', () => {
    // The second row, to prove the index is the row's real position and not 0.
    mockRows = [{ id: 'z', blockType: 'hero' }, { id: 'a', blockType: 'hero' }]
    render(<BlockContentEditor />)

    expect(renderFieldsCalls.length).toBeGreaterThan(0)
    const call = renderFieldsCalls[0]
    expect(call.parentPath).toBe('layout.1')
    // `${parentSchemaPath}.${field.name}` is how Payload derives each child's
    // schema path (payload/dist/fields/getFieldPaths.js), so this must resolve
    // to pages.layout.hero.heading for the hero's heading.
    expect(call.parentSchemaPath).toBe('pages.layout.hero')
    expect(call.parentIndexPath).toBe('')
  })

  it('prompts the admin to pick a block when nothing is selected', () => {
    mockSelectedId = null
    mockRows = [{ id: 'a', blockType: 'hero' }]
    render(<BlockContentEditor />)

    expect(screen.getByText(/select a block/i)).toBeTruthy()
    expect(screen.queryByTestId('render-fields')).toBeNull()
  })

  it('renders no fields when the selected id has no matching row', () => {
    // Selection and form state momentarily out of sync — must not throw, and
    // must not render another block's fields.
    mockRows = [{ id: 'other', blockType: 'hero' }]
    render(<BlockContentEditor />)

    expect(screen.queryByTestId('render-fields')).toBeNull()
  })

  it('opens the expanded drawer when the expand control is used', () => {
    mockRows = [{ id: 'a', blockType: 'hero' }]
    render(<BlockContentEditor />)

    fireEvent.click(screen.getByRole('button', { name: /expand/i }))
    expect(openModal).toHaveBeenCalledWith('nb-content-drawer')
  })

  it('renders the same fields in the drawer as in the panel, from one definition', () => {
    mockRows = [{ id: 'a', blockType: 'hero' }]
    render(<BlockContentEditor />)

    // Panel + drawer both mount RenderFields with identical props — one source
    // of truth for the field tree, so the two layouts cannot drift.
    expect(renderFieldsCalls.length).toBe(2)
    expect(renderFieldsCalls[0].parentPath).toBe(renderFieldsCalls[1].parentPath)
    expect(renderFieldsCalls[0].parentSchemaPath).toBe(renderFieldsCalls[1].parentSchemaPath)
    expect(renderFieldsCalls[0].fields.map((f) => f.name)).toEqual(
      renderFieldsCalls[1].fields.map((f) => f.name),
    )
  })
})
