import { describe, expect, it } from 'vitest'
import { VideoEmbed } from './config'

/**
 * Niblr does not host video. No transcoding, no adaptive bitrate, no poster
 * generation — a merchant uploads a 1080p MP4 and a shopper on a slow connection
 * gets a stalling player. It is also the single fastest way for one tenant to
 * exhaust a storage tier.
 *
 * MEDIA-PIPELINE Task 6. These fail if the option is ever quietly restored.
 */

const field = (name: string) => VideoEmbed.fields.find((f) => 'name' in f && f.name === name)

describe('VideoEmbed providers', () => {
  it('offers YouTube and Vimeo only', () => {
    const provider = field('provider') as { options?: { value: string }[] }
    expect(provider.options?.map((o) => o.value)).toEqual(['youtube', 'vimeo'])
  })

  it('does not offer self-hosted video', () => {
    const provider = field('provider') as { options?: { value: string }[] }
    expect(provider.options?.map((o) => o.value)).not.toContain('file')
  })

  it('has no upload field for a video file', () => {
    // The upload field is what made a 500 MB MP4 possible in the first place.
    expect(field('file')).toBeUndefined()
  })

  it('keeps the poster upload — it is a normal image and gets srcset', () => {
    expect(field('poster')).toMatchObject({ type: 'upload', relationTo: 'media' })
  })

  it('tells the merchant why, on the field itself', () => {
    // Removing an option without saying why invites a support ticket and a
    // request to put it back.
    const provider = field('provider') as { admin?: { description?: string } }
    expect(provider.admin?.description).toMatch(/transcoding/i)
  })
})
