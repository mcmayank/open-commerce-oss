import { describe, it, expect } from 'vitest'
import { DEVICE_WIDTHS, fitCanvas } from './canvas-fit'

describe('fitCanvas', () => {
  it('scales a desktop canvas down into a narrower slot', () => {
    const fit = fitCanvas('desktop', 800)
    expect(fit.deviceWidth).toBe(1280)
    expect(fit.scale).toBeCloseTo(0.625, 5)
    expect(fit.zoomPercent).toBe(63)
  })

  it('never scales up — a narrow device in a wide slot stays 1:1', () => {
    const fit = fitCanvas('mobile', 800)
    expect(fit.deviceWidth).toBe(390)
    expect(fit.scale).toBe(1)
    expect(fit.zoomPercent).toBe(100)
  })

  it('reports the device width regardless of the slot, so the storefront breakpoint follows the device', () => {
    expect(fitCanvas('tablet', 300).deviceWidth).toBe(DEVICE_WIDTHS.tablet)
    expect(fitCanvas('tablet', 3000).deviceWidth).toBe(DEVICE_WIDTHS.tablet)
  })

  it('treats an unmeasured slot as full scale rather than dividing by zero', () => {
    expect(fitCanvas('desktop', 0).scale).toBe(1)
    expect(fitCanvas('desktop', -20).scale).toBe(1)
    expect(Number.isFinite(fitCanvas('desktop', 0).zoomPercent)).toBe(true)
  })

  it('rounds the zoom readout to a whole percent', () => {
    expect(fitCanvas('tablet', 800).zoomPercent).toBe(96)
  })
})
