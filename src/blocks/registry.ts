import type { Block } from 'payload'
import { Hero } from '@/blocks/Hero/config'
import { RichTextBlock } from '@/blocks/RichText/config'
import { ProductGrid } from '@/blocks/ProductGrid/config'
import { ImageGallery } from '@/blocks/ImageGallery/config'
import { CTABanner } from '@/blocks/CTABanner/config'
import { Testimonials } from '@/blocks/Testimonials/config'
import { FAQ } from '@/blocks/FAQ/config'
import { NewsletterSignup } from '@/blocks/NewsletterSignup/config'
import { SplitHero } from '@/blocks/SplitHero/config'
import { Spacer } from '@/blocks/Spacer/config'
import { FeatureGrid } from '@/blocks/FeatureGrid/config'
import { Steps } from '@/blocks/Steps/config'
import { LogoStrip } from '@/blocks/LogoStrip/config'
import { VideoEmbed } from '@/blocks/VideoEmbed/config'
import { Contact } from '@/blocks/Contact/config'
import { FeaturedProduct } from '@/blocks/FeaturedProduct/config'
import { Incentives } from '@/blocks/Incentives/config'
import { CategoryPreviews } from '@/blocks/CategoryPreviews/config'
import { PromoSection } from '@/blocks/PromoSection/config'
import { Reviews } from '@/blocks/Reviews/config'
import { MediaHero } from '@/blocks/MediaHero/config'
import { Ticker } from '@/blocks/Ticker/config'
import { StoryStats } from '@/blocks/StoryStats/config'
import { CustomSection } from '@/blocks/CustomSection/config'

/**
 * The single source of truth for storefront page-builder blocks. Consumed by the `Pages.layout`
 * field (src/collections/Pages.ts) AND the `list_blocks` MCP tool (src/mcp/blocks.ts), so an AI
 * client is always offered exactly the blocks the page builder accepts — no drift.
 */
export const PAGE_BLOCKS: Block[] = [
  Hero, RichTextBlock, ProductGrid, ImageGallery, CTABanner, Testimonials, FAQ, NewsletterSignup,
  SplitHero, Spacer, FeatureGrid, Steps, LogoStrip, VideoEmbed, Contact, FeaturedProduct, Incentives,
  CategoryPreviews, PromoSection, Reviews, MediaHero, Ticker, StoryStats, CustomSection,
]
