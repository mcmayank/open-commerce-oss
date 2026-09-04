/** @vitest-environment jsdom */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { useBuilderFormState, type BuilderFormStateArgs } from './useBuilderFormState'

afterEach(() => {
  cleanup()
})

const FORM_STATE = { title: { value: 'Home' }, layout: { rows: [{ id: 'a' }] } }

function makeArgs(overrides: Partial<BuilderFormStateArgs> = {}): BuilderFormStateArgs {
  return {
    collectionSlug: 'pages',
    data: { id: 5, title: 'Home' },
    docPermissions: undefined,
    getDocPreferences: async () => ({ fields: {} }),
    getFormState: (async () => ({ state: FORM_STATE })) as unknown as BuilderFormStateArgs['getFormState'],
    id: 5,
    operation: 'update',
    ...overrides,
  }
}

/**
 * Renders the hook's outcome as text so a test can assert on it without
 * reaching for a hook-testing library. `pending` is the state the builder
 * shows as "Loading page builder…" — a hook that never leaves it is the bug
 * this file exists to pin.
 */
function Probe(args: BuilderFormStateArgs) {
  const { failed, state } = useBuilderFormState(args)
  if (failed) return <div>failed</div>
  if (!state) return <div>pending</div>
  return <div>rows:{String((state as Record<string, { rows?: unknown[] }>).layout?.rows?.length)}</div>
}

describe('useBuilderFormState', () => {
  it('resolves the form state under React StrictMode, whose double-invoked effects must not strand the loader', async () => {
    // StrictMode runs every effect setup → cleanup → setup. Any one-shot load
    // that arms a "started" guard on the first setup AND cancels itself in the
    // cleanup can never finish: the second setup is refused by the guard, and
    // the first run's result is discarded as cancelled. Next enables
    // StrictMode by default for the App Router, so this is what `pnpm dev`
    // actually does — and the builder would hang on its loading state forever.
    const args = makeArgs()
    render(
      <React.StrictMode>
        <Probe {...args} />
      </React.StrictMode>,
    )

    await waitFor(() => expect(screen.getByText('rows:1')).toBeTruthy())
  })

  it('calls getFormState exactly once even though StrictMode mounts twice', async () => {
    const getFormState = vi.fn(async (_args: Record<string, unknown>) => ({ state: FORM_STATE }))
    const args = makeArgs({
      getFormState: getFormState as unknown as BuilderFormStateArgs['getFormState'],
    })

    render(
      <React.StrictMode>
        <Probe {...args} />
      </React.StrictMode>,
    )

    await waitFor(() => expect(screen.getByText('rows:1')).toBeTruthy())
    expect(getFormState).toHaveBeenCalledTimes(1)
  })

  it('asks the server to render every field, unlike the onChange path', async () => {
    const getFormState = vi.fn(async (_args: Record<string, unknown>) => ({ state: FORM_STATE }))
    render(
      <Probe
        {...makeArgs({
          getFormState: getFormState as unknown as BuilderFormStateArgs['getFormState'],
        })}
      />,
    )

    await waitFor(() => expect(getFormState).toHaveBeenCalledTimes(1))
    const call = getFormState.mock.calls[0]?.[0]
    expect(call).toBeTruthy()
    if (!call) throw new Error('getFormState was not called')
    expect(call.renderAllFields).toBe(true)
    // `buildFormState` derives data as `incomingData || reduceFieldsToValues(formState)`,
    // and there is no prior form state on the first call — so `data` is required.
    expect(call.data).toEqual({ id: 5, title: 'Home' })
    expect(call.skipValidation).toBe(true)
  })

  it('reports failure rather than spinning forever when the server function throws', async () => {
    const args = makeArgs({
      getFormState: (async () => {
        throw new Error('nope')
      }) as unknown as BuilderFormStateArgs['getFormState'],
    })
    render(<Probe {...args} />)
    await waitFor(() => expect(screen.getByText('failed')).toBeTruthy())
  })

  it('stays pending, and calls nothing, until the document data has arrived', async () => {
    const getFormState = vi.fn(async (_args: Record<string, unknown>) => ({ state: FORM_STATE }))
    render(
      <Probe
        {...makeArgs({
          data: undefined,
          getFormState: getFormState as unknown as BuilderFormStateArgs['getFormState'],
        })}
      />,
    )
    expect(screen.getByText('pending')).toBeTruthy()
    expect(getFormState).not.toHaveBeenCalled()
  })
})
