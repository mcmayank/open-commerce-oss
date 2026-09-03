/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { HeroComponent } from './Component'
import { Hero } from './config'

afterEach(cleanup)

/** The element each variant hangs its height on. */
function heightHost(container: HTMLElement, variant: string): HTMLElement {
  // split/showcase put the height on the inner grid, not the <section>.
  return variant === 'split' || variant === 'showcase'
    ? (container.querySelector('.grid') as HTMLElement)
    : (container.querySelector('section') as HTMLElement)
}

function renderHero(block: Record<string, unknown>) {
  const el = HeroComponent({ block: { heading: 'Hi', ...block } as any, ctx: {} as any })
  return render(el as any)
}

const field = Hero.fields.find((f) => 'name' in f && f.name === 'minHeight') as any

describe('Hero minHeight — field config', () => {
  it('offers auto, the pixel presets, the fractions and full screen', () => {
    const values = field.options.map((o: any) => o.value)
    expect(values).toEqual(['auto', 'md', 'lg', 'half', 'threeQuarter', 'screen'])
  })

  it('is available on EVERY variant, not just overlay and video', () => {
    // The original bug: an admin.condition limited this to overlay/video, so
    // four of the six variants had no height control at all.
    expect(field.admin?.condition).toBeUndefined()
  })

  it('defaults to auto, so a new hero imposes no height of its own', () => {
    expect(field.defaultValue).toBe('auto')
  })
})

describe('Hero minHeight — auto preserves each variant’s existing height', () => {
  // Every hero row in the database stores min_height='lg' (written by the old
  // defaultValue while the field was hidden). The 20260829 migration rewrites
  // non-overlay rows to 'auto', and these assertions are what "auto renders
  // exactly as before" means for each branch.
  it('centered keeps its 420px floor', () => {
    const { container } = renderHero({ variant: 'centered', minHeight: 'auto' })
    expect(heightHost(container, 'centered').className).toContain('min-h-[420px]')
  })

  it('split keeps its 420px grid floor', () => {
    const { container } = renderHero({ variant: 'split', minHeight: 'auto' })
    expect(heightHost(container, 'split').className).toContain('min-h-[420px]')
  })

  it('overlay keeps the 480px it got from the old lg default', () => {
    const { container } = renderHero({ variant: 'overlay', minHeight: 'auto' })
    expect(heightHost(container, 'overlay').className).toContain('min-h-[480px]')
  })

  it('stacked imposes no height, as before', () => {
    const { container } = renderHero({ variant: 'stacked', minHeight: 'auto' })
    expect(heightHost(container, 'stacked').className).not.toContain('min-h-')
  })

  it('treats a missing minHeight the same as auto', () => {
    const { container } = renderHero({ variant: 'centered' })
    expect(heightHost(container, 'centered').className).toContain('min-h-[420px]')
  })
})

describe('Hero minHeight — an explicit choice applies on every variant', () => {
  const cases: Array<[string, string]> = [
    ['half', 'min-h-[50vh]'],
    ['threeQuarter', 'min-h-[75vh]'],
    ['screen', 'min-h-screen'],
    ['md', 'min-h-[380px]'],
    ['lg', 'min-h-[480px]'],
  ]

  for (const variant of ['centered', 'split', 'stacked', 'overlay']) {
    for (const [value, expected] of cases) {
      it(`${variant} + ${value} renders ${expected}`, () => {
        const { container } = renderHero({ variant, minHeight: value })
        expect(heightHost(container, variant).className).toContain(expected)
      })
    }
  }

  it('replaces the auto fallback rather than stacking a second min-h class', () => {
    // Two min-h-* classes on one element collide on specificity and the winner
    // depends on stylesheet order — the explicit choice must REPLACE the base.
    const { container } = renderHero({ variant: 'centered', minHeight: 'screen' })
    const cls = heightHost(container, 'centered').className
    expect(cls).toContain('min-h-screen')
    expect(cls).not.toContain('min-h-[420px]')
  })
})
