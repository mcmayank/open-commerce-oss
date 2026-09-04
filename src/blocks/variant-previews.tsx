import * as React from 'react'

// Admin-themed preview kit for block `variant` pickers. Rendered inside the Payload
// admin only, so they use admin CSS vars (--theme-elevation-*, --theme-success-*) —
// never the storefront --color-* vars, which are per-tenant and not meaningful here.
//
// Every preview composes from the shared primitives below and sits in a fixed-height
// `Frame`, so all blocks read as one consistent family of literal mini-mockups
// (image glyphs, real "Heading"/"Shop" text, framed cards) rather than abstract
// wireframes. This is the same idiom the Split Hero previews established.

const IMG = 'var(--theme-elevation-150)'
const MARK = 'var(--theme-elevation-400)'
const BAR = 'var(--theme-elevation-300)'
const BARSTRONG = 'var(--theme-elevation-500)'
const HEADING = 'var(--theme-elevation-800)'
const ACCENT = 'var(--theme-success-500)'
const ON = 'var(--theme-elevation-0)' // foreground on accent / on dark media
const CARD = 'var(--theme-elevation-50)'

// ── Icons ───────────────────────────────────────────────────────────────────
const ImgGlyph: React.FC<{ size?: number; stroke?: string }> = ({ size = 16, stroke = MARK }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10" r="1.6" />
    <path d="M5 17l4.5-4 3 2.2 3.5-4.2 4 6" />
  </svg>
)

const PlayGlyph: React.FC<{ size?: number; onDark?: boolean }> = ({ size = 26, onDark }) => (
  <span
    style={{
      width: size, height: size, borderRadius: '50%',
      background: onDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.55)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} aria-hidden="true">
      <path d="M8 5v14l11-7z" fill={onDark ? '#111' : '#fff'} />
    </svg>
  </span>
)

const MapPin: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={MARK} strokeWidth="1.6" aria-hidden="true">
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.4" fill={MARK} stroke="none" />
  </svg>
)

const ArrowGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const Star: React.FC<{ size?: number }> = ({ size = 8 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={ACCENT} aria-hidden="true">
    <path d="M12 2l3 6.3 6.9.9-5 4.8 1.2 6.8L12 17.8 5.9 20.8 7.1 14l-5-4.8L9 8.3z" />
  </svg>
)
const StarRow: React.FC<{ n?: number; size?: number }> = ({ n = 5, size = 8 }) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {Array.from({ length: n }).map((_, i) => <Star key={i} size={size} />)}
  </div>
)

// ── Atoms ───────────────────────────────────────────────────────────────────
const ImageBox: React.FC<{ style?: React.CSSProperties; glyph?: boolean; glyphSize?: number; children?: React.ReactNode }> = ({ style, glyph = true, glyphSize, children }) => (
  <div style={{ background: IMG, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
    {children ?? (glyph && <ImgGlyph size={glyphSize} />)}
  </div>
)

const Bar: React.FC<{ w: number | string; h?: number; c?: string; r?: number }> = ({ w, h = 4, c = BAR, r }) => (
  <span style={{ display: 'block', width: w, height: h, borderRadius: r ?? h / 2, background: c }} />
)

type LineRow = { w: number | string; h?: number; c?: string }
const Lines: React.FC<{ rows: LineRow[]; gap?: number; align?: 'flex-start' | 'center' }> = ({ rows, gap = 4, align = 'flex-start' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap, alignItems: align, width: '100%' }}>
    {rows.map((r, i) => <Bar key={i} w={r.w} h={r.h} c={r.c} />)}
  </div>
)

const Eyebrow: React.FC<{ text?: string; onDark?: boolean }> = ({ text = 'New in', onDark }) => (
  <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: onDark ? 'rgba(255,255,255,0.85)' : ACCENT }}>
    {text}
  </span>
)
const Heading: React.FC<{ text?: string; onDark?: boolean; size?: number }> = ({ text = 'Heading', onDark, size = 12 }) => (
  <span style={{ fontSize: size, fontWeight: 700, lineHeight: 1.05, color: onDark ? '#fff' : HEADING }}>{text}</span>
)

const CtaRow: React.FC<{ center?: boolean; onDark?: boolean; onAccent?: boolean }> = ({ center, onDark, onAccent }) => (
  <div style={{ display: 'flex', gap: 5, marginTop: 3, justifyContent: center ? 'center' : 'flex-start' }}>
    <span style={{ fontSize: 8, fontWeight: 600, color: onAccent ? ACCENT : '#fff', background: onAccent ? ON : ACCENT, borderRadius: 999, padding: '2px 7px', lineHeight: 1.4 }}>
      Shop
    </span>
    <span style={{ width: 24, height: 15, borderRadius: 999, border: `1px solid ${onDark || onAccent ? 'rgba(255,255,255,0.8)' : BARSTRONG}` }} />
  </div>
)

const NumDot: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <span style={{ width: size, height: size, borderRadius: '50%', background: ACCENT, flex: 'none', display: 'inline-block' }} />
)

const LogoChip: React.FC<{ w?: number; h?: number }> = ({ w = 38, h = 16 }) => (
  <span style={{ width: w, height: h, borderRadius: 4, background: BAR, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
    <span style={{ width: h * 0.5, height: h * 0.5, borderRadius: '50%', background: MARK }} />
  </span>
)

// ── Layout helpers ──────────────────────────────────────────────────────────
const Frame: React.FC<{ children: React.ReactNode; label: string; pad?: number; bg?: string }> = ({ children, label, pad = 10, bg = CARD }) => (
  <div role="img" aria-label={label} style={{ border: `1px solid ${IMG}`, borderRadius: 8, padding: pad, height: 132, boxSizing: 'border-box', background: bg, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: '100%' }}>{children}</div>
  </div>
)

const Row: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; gap?: number }> = ({ children, style, gap = 10 }) => (
  <div style={{ display: 'flex', gap, height: '100%', ...style }}>{children}</div>
)
const Col: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; center?: boolean }> = ({ children, style, center }) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, ...(center ? { alignItems: 'center', justifyContent: 'center', textAlign: 'center' } : {}), ...style }}>{children}</div>
)

// ── Molecules ───────────────────────────────────────────────────────────────
const HeroText: React.FC<{ center?: boolean; onDark?: boolean; onAccent?: boolean }> = ({ center, onDark, onAccent }) => (
  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 0, alignItems: center ? 'center' : 'flex-start', textAlign: center ? 'center' : 'left' }}>
    <Eyebrow onDark={onDark || onAccent} />
    <Heading onDark={onDark || onAccent} />
    <Bar w={62} c={onDark || onAccent ? 'rgba(255,255,255,0.6)' : BAR} />
    <Bar w={44} c={onDark || onAccent ? 'rgba(255,255,255,0.6)' : BAR} />
    <CtaRow center={center} onDark={onDark} onAccent={onAccent} />
  </div>
)

const ProductText: React.FC<{ center?: boolean; onDark?: boolean }> = ({ center, onDark }) => (
  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 0, alignItems: center ? 'center' : 'flex-start', textAlign: center ? 'center' : 'left' }}>
    <Heading text="Product" onDark={onDark} />
    <Bar w={34} h={7} c={ACCENT} />
    <Bar w={64} c={onDark ? 'rgba(255,255,255,0.6)' : BAR} />
    <Bar w={50} c={onDark ? 'rgba(255,255,255,0.6)' : BAR} />
    <CtaRow center={center} onDark={onDark} />
  </div>
)

const StatItem: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <Bar w={20} h={9} c={BARSTRONG} />
    <Bar w={24} h={4} c={BAR} />
  </div>
)

const ProductCard: React.FC<{ style?: React.CSSProperties; wide?: boolean }> = ({ style, wide }) => (
  <div style={{ border: `1px solid ${BAR}`, borderRadius: 6, padding: 6, display: 'flex', flexDirection: 'column', gap: 6, boxSizing: 'border-box', ...style }}>
    <ImageBox style={{ width: '100%', height: wide ? '52%' : '54%' }} glyphSize={14} />
    <Bar w={wide ? '70%' : '80%'} h={5} c={BARSTRONG} />
    <Bar w="46%" h={5} c={ACCENT} />
  </div>
)

// ── Split Hero ──────────────────────────────────────────────────────────────
const MediaLeft = () => (
  <Frame label="Media left, text right">
    <Row>
      <ImageBox style={{ width: '42%' }} />
      <div style={{ flex: 1, display: 'flex' }}><HeroText /></div>
    </Row>
  </Frame>
)
const MediaRight = () => (
  <Frame label="Media right, text left">
    <Row>
      <div style={{ flex: 1, display: 'flex' }}><HeroText /></div>
      <ImageBox style={{ width: '42%' }} />
    </Row>
  </Frame>
)
const Overlay = () => (
  <Frame label="Full-bleed image with overlaid text" pad={0}>
    <div style={{ position: 'relative', height: '100%', background: IMG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ position: 'absolute', top: 8, left: 8 }}><ImgGlyph /></span>
      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.1))' }} />
      <div style={{ position: 'relative', padding: 10 }}><HeroText center onDark /></div>
    </div>
  </Frame>
)
const Stacked = () => (
  <Frame label="Stacked, image on top">
    <Col>
      <ImageBox style={{ height: '46%' }} />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', marginTop: 8 }}><HeroText center /></div>
    </Col>
  </Frame>
)

// ── Hero (unified) ──────────────────────────────────────────────────────────
const HeroCentered = () => (
  <Frame label="Centered, text only">
    <Col center style={{ justifyContent: 'center' }}><HeroText center /></Col>
  </Frame>
)
const HeroSplit = () => (
  <Frame label="Split, media beside text">
    <Row>
      <div style={{ flex: 1, display: 'flex' }}><HeroText /></div>
      <ImageBox style={{ width: '42%' }} />
    </Row>
  </Frame>
)
const HeroOverlay = () => (
  <Frame label="Full-bleed overlay" pad={0}>
    <div style={{ position: 'relative', height: '100%', background: IMG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ position: 'absolute', top: 8, left: 8 }}><ImgGlyph /></span>
      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.1))' }} />
      <div style={{ position: 'relative', padding: 10 }}><HeroText center onDark /></div>
    </div>
  </Frame>
)
const HeroVideo = () => (
  <Frame label="Video background" pad={0}>
    <div style={{ position: 'relative', height: '100%', background: IMG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ position: 'absolute', top: 8, left: 8 }}><PlayGlyph size={20} onDark /></span>
      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.15))' }} />
      <div style={{ position: 'relative', padding: 10 }}><HeroText center onDark /></div>
    </div>
  </Frame>
)
const HeroStacked = () => (
  <Frame label="Stacked, image on top">
    <Col>
      <ImageBox style={{ height: '46%' }} />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', marginTop: 8 }}><HeroText center /></div>
    </Col>
  </Frame>
)
const FloatingCardGlyph: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div
    style={{
      position: 'absolute', width: 30, height: 20, borderRadius: 4, background: CARD,
      border: `1px solid ${BAR}`, display: 'flex', alignItems: 'center', gap: 3,
      padding: '0 4px', boxSizing: 'border-box', ...style,
    }}
  >
    <span style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT, flex: 'none' }} />
    <Bar w="60%" h={3} />
  </div>
)
const HeroShowcase = () => (
  <Frame label="Showcase, media with floating cards">
    <Row>
      <div style={{ flex: 1, display: 'flex' }}><HeroText /></div>
      <div style={{ width: '42%', position: 'relative' }}>
        <ImageBox style={{ position: 'absolute', inset: 0 }} />
        <FloatingCardGlyph style={{ top: -6, right: -6 }} />
        <FloatingCardGlyph style={{ bottom: -6, left: -6 }} />
      </div>
    </Row>
  </Frame>
)

// ── Media Hero ──────────────────────────────────────────────────────────────
const MediaHeroSplit = () => (
  <Frame label="Media hero, split card">
    <Row gap={8}>
      <ImageBox style={{ width: '40%' }} />
      <div style={{ flex: 1, background: ACCENT, borderRadius: 4, padding: 10, display: 'flex' }}>
        <HeroText onAccent />
      </div>
    </Row>
  </Frame>
)
const MediaHeroOverlay = () => (
  <Frame label="Media hero, full-bleed overlay" pad={0}>
    <div style={{ position: 'relative', height: '100%', background: IMG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.15))' }} />
      <span style={{ position: 'absolute', top: 8, left: 8 }}><ImgGlyph stroke="rgba(255,255,255,0.85)" /></span>
      <div style={{ position: 'relative', padding: 10 }}><HeroText center onDark /></div>
    </div>
  </Frame>
)

// ── Featured Product ────────────────────────────────────────────────────────
const FeaturedImageLeft = () => (
  <Frame label="Featured product, image left">
    <Row><ImageBox style={{ width: '44%' }} /><div style={{ flex: 1, display: 'flex' }}><ProductText /></div></Row>
  </Frame>
)
const FeaturedImageRight = () => (
  <Frame label="Featured product, image right">
    <Row><div style={{ flex: 1, display: 'flex' }}><ProductText /></div><ImageBox style={{ width: '44%' }} /></Row>
  </Frame>
)
const FeaturedOverlay = () => (
  <Frame label="Featured product, full-bleed overlay" pad={0}>
    <div style={{ position: 'relative', height: '100%', background: IMG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.1))' }} />
      <span style={{ position: 'absolute', top: 8, left: 8 }}><ImgGlyph stroke="rgba(255,255,255,0.85)" /></span>
      <div style={{ position: 'relative', padding: 10 }}><ProductText center onDark /></div>
    </div>
  </Frame>
)
const FeaturedStacked = () => (
  <Frame label="Featured product, stacked">
    <Col><ImageBox style={{ height: '46%' }} /><div style={{ flex: 1, display: 'flex', justifyContent: 'center', marginTop: 8 }}><ProductText center /></div></Col>
  </Frame>
)

// ── Promo Section ───────────────────────────────────────────────────────────
const PromoSplit = () => (
  <Frame label="Promo, split image">
    <Row><ImageBox style={{ width: '44%' }} /><div style={{ flex: 1, display: 'flex' }}><HeroText /></div></Row>
  </Frame>
)
const PromoOverlay = () => (
  <Frame label="Promo, full-bleed overlay" pad={0}>
    <div style={{ position: 'relative', height: '100%', background: IMG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{ position: 'relative', padding: 10 }}><HeroText center onDark /></div>
    </div>
  </Frame>
)
const PromoBanner = () => (
  <Frame label="Promo, compact banner" pad={0}>
    <div style={{ height: '100%', background: BARSTRONG, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Bar w={70} h={8} c={ON} />
        <Bar w={100} h={4} c="rgba(255,255,255,0.6)" />
      </div>
      <span style={{ width: 46, height: 16, borderRadius: 8, background: ACCENT }} />
    </div>
  </Frame>
)

// ── Story + Stats ───────────────────────────────────────────────────────────
const StoryCol: React.FC = () => (
  <Col style={{ justifyContent: 'center', gap: 6, flex: 1 }}>
    <Eyebrow text="Our story" />
    <Heading />
    <Lines rows={[{ w: 90 }, { w: 78 }]} />
    <div style={{ display: 'flex', gap: 14, marginTop: 4 }}><StatItem /><StatItem /><StatItem /></div>
  </Col>
)
const StoryImageRight = () => (
  <Frame label="Story + stats, image right"><Row><StoryCol /><ImageBox style={{ width: '40%' }} /></Row></Frame>
)
const StoryImageLeft = () => (
  <Frame label="Story + stats, image left"><Row><ImageBox style={{ width: '40%' }} /><StoryCol /></Row></Frame>
)

// ── Spacer ──────────────────────────────────────────────────────────────────
const SpacerFrame: React.FC<{ divider: React.ReactNode; label: string }> = ({ divider, label }) => (
  <Frame label={label}>
    <Col style={{ justifyContent: 'space-between' }}>
      <Lines rows={[{ w: '55%', h: 6, c: BARSTRONG }, { w: '92%' }, { w: '84%' }]} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 16 }}>{divider}</div>
      <Lines rows={[{ w: '88%' }, { w: '76%' }, { w: '50%' }]} />
    </Col>
  </Frame>
)
const SpacerBlank = () => <SpacerFrame label="Blank space" divider={null} />
const SpacerLine = () => <SpacerFrame label="Divider line" divider={<div style={{ width: '100%', borderTop: `2px solid ${BARSTRONG}` }} />} />
const SpacerDots = () => <SpacerFrame label="Dotted divider" divider={<div style={{ display: 'flex', gap: 5 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: BARSTRONG }} />)}</div>} />
const SpacerGradient = () => <SpacerFrame label="Gradient divider" divider={<div style={{ width: '70%', height: 4, borderRadius: 2, background: `linear-gradient(to right, transparent, ${ACCENT}, transparent)` }} />} />

// ── Feature Grid ────────────────────────────────────────────────────────────
const FeatureHeader: React.FC = () => <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Bar w={60} h={6} c={BARSTRONG} /></div>
const FeatureCol: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 5 }}>{children}</div>
const Icon: React.FC<{ size?: number }> = ({ size = 16 }) => <span style={{ width: size, height: size, borderRadius: '50%', background: MARK, flex: 'none' }} />

const FeatureIconTop = () => (
  <Frame label="Feature grid, icon on top">
    <FeatureHeader />
    <Row gap={10}>{[0, 1, 2].map((i) => <FeatureCol key={i}><Icon /><Bar w={40} h={6} c={BARSTRONG} /><Bar w={48} /></FeatureCol>)}</Row>
  </Frame>
)
const FeatureIconLeft = () => (
  <Frame label="Feature grid, icon on left">
    <FeatureHeader />
    <Row gap={10}>{[0, 1, 2].map((i) => (
      <div key={i} style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <Icon size={13} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><Bar w={30} h={6} c={BARSTRONG} /><Bar w={26} /></div>
      </div>
    ))}</Row>
  </Frame>
)
const FeatureCards = () => (
  <Frame label="Feature grid, cards">
    <FeatureHeader />
    <Row gap={8}>{[0, 1, 2].map((i) => (
      <div key={i} style={{ flex: 1, border: `1px solid ${BAR}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
        <Icon /><Bar w={30} h={6} c={BARSTRONG} /><Bar w={38} />
      </div>
    ))}</Row>
  </Frame>
)
const FeatureMinimal = () => (
  <Frame label="Feature grid, minimal">
    <FeatureHeader />
    <Row gap={10}>{[0, 1, 2].map((i) => <FeatureCol key={i}><Bar w={44} h={6} c={BARSTRONG} /><Bar w={52} /><Bar w={40} /></FeatureCol>)}</Row>
  </Frame>
)

// ── Steps ───────────────────────────────────────────────────────────────────
const StepsHorizontal = () => (
  <Frame label="Steps, horizontal row">
    <Col center style={{ justifyContent: 'center', gap: 10 }}>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', width: '86%', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: 8, right: 8, top: '50%', height: 2, background: BAR }} />
        {[0, 1, 2].map((i) => <span key={i} style={{ position: 'relative' }}><NumDot /></span>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '92%' }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}><Bar w={32} h={6} c={BARSTRONG} /><Bar w={40} /></div>)}
      </div>
    </Col>
  </Frame>
)
const StepsVertical = () => (
  <Frame label="Steps, vertical timeline">
    <div style={{ position: 'relative', height: '100%', paddingLeft: 4 }}>
      <span style={{ position: 'absolute', left: 11, top: 10, bottom: 10, width: 2, background: BAR }} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
            <NumDot /><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><Bar w={60} h={6} c={BARSTRONG} /><Bar w={120} /></div>
          </div>
        ))}
      </div>
    </div>
  </Frame>
)
const StepsCards = () => (
  <Frame label="Steps, bordered cards">
    <Row gap={8}>{[0, 1, 2].map((i) => (
      <div key={i} style={{ flex: 1, border: `1px solid ${BAR}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <NumDot size={14} /><Bar w={34} h={6} c={BARSTRONG} /><Bar w={42} />
      </div>
    ))}</Row>
  </Frame>
)
const StepsCompact = () => (
  <Frame label="Steps, compact stacked list">
    <Col style={{ justifyContent: 'space-between' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <NumDot /><div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}><Bar w={60} h={6} c={BARSTRONG} /><Bar w={140} /></div>
        </div>
      ))}
    </Col>
  </Frame>
)

// ── Logo Strip ──────────────────────────────────────────────────────────────
const LogoStaticRow = () => (
  <Frame label="Logos, centered row">
    <Col center style={{ justifyContent: 'center' }}><div style={{ display: 'flex', gap: 10 }}>{[0, 1, 2, 3].map((i) => <LogoChip key={i} />)}</div></Col>
  </Frame>
)
const LogoGrid = () => (
  <Frame label="Logos, grid">
    <Col center style={{ justifyContent: 'center', gap: 10 }}>
      {[0, 1].map((r) => <div key={r} style={{ display: 'flex', gap: 12 }}>{[0, 1, 2].map((i) => <LogoChip key={i} w={44} h={22} />)}</div>)}
    </Col>
  </Frame>
)
const LogoMarquee = () => (
  <Frame label="Logos, scrolling marquee">
    <Col center style={{ justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>{[0, 1, 2, 3].map((i) => <LogoChip key={i} w={34} />)}<ArrowGlyph /></div>
    </Col>
  </Frame>
)
const LogoBordered = () => (
  <Frame label="Logos, bordered cells">
    <Col center style={{ justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {[0, 1, 2, 3].map((i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ width: 1, height: 30, background: BAR, margin: '0 10px' }} />}
            <LogoChip w={32} />
          </React.Fragment>
        ))}
      </div>
    </Col>
  </Frame>
)

// ── Video Embed ─────────────────────────────────────────────────────────────
const VideoContained = () => (
  <Frame label="Video, contained">
    <Col center style={{ justifyContent: 'center' }}>
      <ImageBox glyph={false} style={{ width: '68%', height: '78%', position: 'relative' }}>
        <PlayGlyph />
      </ImageBox>
    </Col>
  </Frame>
)
const VideoFullBleed = () => (
  <Frame label="Video, full bleed" pad={0}>
    <div style={{ height: '100%', background: IMG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlayGlyph size={30} /></div>
  </Frame>
)
const VideoSideBySide = () => (
  <Frame label="Video, side by side with text">
    <Row>
      <ImageBox glyph={false} style={{ width: '48%' }}><PlayGlyph size={24} /></ImageBox>
      <Col style={{ justifyContent: 'center', gap: 5, flex: 1 }}><Bar w={70} h={7} c={BARSTRONG} /><Lines rows={[{ w: 90 }, { w: 78 }, { w: 60 }]} /></Col>
    </Row>
  </Frame>
)
const VideoTextOverlay = () => (
  <Frame label="Video, text overlaid on poster" pad={0}>
    <div style={{ position: 'relative', height: '100%', background: IMG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      <span style={{ position: 'relative' }}><Bar w={88} h={8} c={ON} /></span>
      <span style={{ position: 'relative' }}><PlayGlyph size={26} onDark /></span>
    </div>
  </Frame>
)

// ── Contact ─────────────────────────────────────────────────────────────────
const ContactDetails: React.FC<{ center?: boolean }> = ({ center }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: center ? 'center' : 'flex-start' }}>
    <Bar w={56} h={7} c={BARSTRONG} />
    <Lines rows={[{ w: 84 }, { w: 70 }, { w: 60 }]} align={center ? 'center' : 'flex-start'} />
    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
      <span style={{ width: 30, height: 12, borderRadius: 6, background: ACCENT }} />
      <span style={{ width: 42, height: 12, borderRadius: 6, border: `1px solid ${BARSTRONG}` }} />
    </div>
  </div>
)
const MapBox: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div style={{ background: IMG, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}><MapPin /></div>
)
const ContactMapSplit = () => (
  <Frame label="Contact details and map, side by side"><Row><Col style={{ justifyContent: 'center', flex: 1 }}><ContactDetails /></Col><MapBox style={{ width: '44%' }} /></Row></Frame>
)
const ContactMapStacked = () => (
  <Frame label="Contact details, map below"><Col style={{ gap: 8 }}><div style={{ display: 'flex', justifyContent: 'center' }}><ContactDetails center /></div><MapBox style={{ width: '100%', flex: 1 }} /></Col></Frame>
)
const ContactDetailsOnly = () => (
  <Frame label="Contact details only, no map"><Col center style={{ justifyContent: 'center' }}><ContactDetails center /></Col></Frame>
)
const ContactBanner = () => (
  <Frame label="Contact, compact banner strip">
    <Col center style={{ justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Bar w={50} h={7} c={BARSTRONG} /><Bar w={40} /><Bar w={30} />
        <span style={{ width: 32, height: 12, borderRadius: 6, background: ACCENT }} />
      </div>
    </Col>
  </Frame>
)

// ── Category Previews ───────────────────────────────────────────────────────
const CategoryGrid = () => (
  <Frame label="Category previews, image grid">
    <Row gap={10} style={{ alignItems: 'center' }}>
      {[0, 1, 2].map((i) => <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}><ImageBox style={{ width: '100%', height: 58 }} /><Bar w={40} h={6} c={BARSTRONG} /></div>)}
    </Row>
  </Frame>
)
const CategoryOverlay = () => (
  <Frame label="Category previews, overlay cards">
    <Row gap={10}>{[0, 1, 2].map((i) => (
      <div key={i} style={{ flex: 1, position: 'relative', borderRadius: 6, overflow: 'hidden', background: IMG }}>
        <ImgGlyph size={14} />
        <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '34%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bar w={34} h={5} c={ON} /></span>
      </div>
    ))}</Row>
  </Frame>
)
const CategoryList = () => (
  <Frame label="Category previews, list rows">
    <Col style={{ justifyContent: 'space-between' }}>{[0, 1, 2].map((i) => (
      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <ImageBox style={{ width: 28, height: 28 }} glyphSize={12} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}><Bar w={70} h={6} c={BARSTRONG} /><Bar w={120} /></div>
      </div>
    ))}</Col>
  </Frame>
)

// ── Reviews ─────────────────────────────────────────────────────────────────
const ReviewBody: React.FC = () => (
  <>
    <StarRow />
    <Lines rows={[{ w: '90%' }, { w: '76%' }]} />
    <Bar w={40} h={6} c={BARSTRONG} />
  </>
)
const ReviewCards = () => (
  <Frame label="Reviews, card grid">
    <Row gap={8}>{[0, 1, 2].map((i) => (
      <div key={i} style={{ flex: 1, border: `1px solid ${BAR}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}><ReviewBody /></div>
    ))}</Row>
  </Frame>
)
const ReviewList = () => (
  <Frame label="Reviews, stacked list">
    <Col style={{ justifyContent: 'space-between' }}>{[0, 1].map((i) => (
      <div key={i} style={{ border: `1px solid ${BAR}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}><StarRow /><Bar w="80%" /><Bar w={44} h={6} c={BARSTRONG} /></div>
    ))}</Col>
  </Frame>
)
const ReviewMasonry = () => (
  <Frame label="Reviews, masonry columns">
    <Row gap={8}>
      {[[62, 40], [44, 56], [54, 44]].map(([a, b], i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ border: `1px solid ${BAR}`, borderRadius: 6, padding: 6, height: a, display: 'flex', flexDirection: 'column', gap: 4 }}><StarRow size={7} /><Bar w="80%" /></div>
          <div style={{ border: `1px solid ${BAR}`, borderRadius: 6, padding: 6, height: b, display: 'flex', flexDirection: 'column', gap: 4 }}><StarRow size={7} /><Bar w="70%" /></div>
        </div>
      ))}
    </Row>
  </Frame>
)

// ── Product Grid ────────────────────────────────────────────────────────────
const PGGrid = () => (
  <Frame label="Products, grid"><Row gap={8}>{[0, 1, 2, 3].map((i) => <ProductCard key={i} style={{ flex: 1 }} />)}</Row></Frame>
)
const PGCarousel = () => (
  <Frame label="Products, carousel">
    <Col style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: 8, flex: 1 }}>{[0, 1, 2, 3].map((i) => <ProductCard key={i} style={{ flex: 1 }} />)}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}><ArrowGlyph /></div>
    </Col>
  </Frame>
)
const PGList = () => (
  <Frame label="Products, list"><Row gap={10} style={{ justifyContent: 'center' }}><ProductCard style={{ width: '42%' }} wide /><ProductCard style={{ width: '42%' }} wide /></Row></Frame>
)

// ── Ticker ──────────────────────────────────────────────────────────────────
const TickerStatic = () => (
  <Frame label="Ticker, centered static row">
    <Col center style={{ justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {[36, 30, 40].map((w, i) => (
          <React.Fragment key={i}>{i > 0 && <span style={{ width: 3, height: 3, borderRadius: '50%', background: ACCENT }} />}<Bar w={w} h={7} c={BARSTRONG} /></React.Fragment>
        ))}
      </div>
    </Col>
  </Frame>
)
const TickerMarquee = () => (
  <Frame label="Ticker, scrolling marquee">
    <Col center style={{ justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {[30, 34, 28, 30].map((w, i) => (
          <React.Fragment key={i}>{i > 0 && <span style={{ width: 3, height: 3, borderRadius: '50%', background: ACCENT }} />}<Bar w={w} h={7} c={BARSTRONG} /></React.Fragment>
        ))}
        <ArrowGlyph />
      </div>
    </Col>
  </Frame>
)

export type VariantPreview = { value: string; label: string; Wireframe: React.FC }

export const VARIANT_PREVIEWS: Record<string, VariantPreview[]> = {
  hero: [
    { value: 'centered', label: 'Centered', Wireframe: HeroCentered },
    { value: 'split', label: 'Split', Wireframe: HeroSplit },
    { value: 'overlay', label: 'Full-bleed overlay', Wireframe: HeroOverlay },
    { value: 'video', label: 'Video background', Wireframe: HeroVideo },
    { value: 'stacked', label: 'Stacked', Wireframe: HeroStacked },
    { value: 'showcase', label: 'Showcase', Wireframe: HeroShowcase },
  ],
  splitHero: [
    { value: 'mediaLeft', label: 'Media left', Wireframe: MediaLeft },
    { value: 'mediaRight', label: 'Media right', Wireframe: MediaRight },
    { value: 'overlay', label: 'Full-bleed overlay', Wireframe: Overlay },
    { value: 'stacked', label: 'Stacked', Wireframe: Stacked },
  ],
  spacer: [
    { value: 'blank', label: 'Blank space', Wireframe: SpacerBlank },
    { value: 'line', label: 'Line', Wireframe: SpacerLine },
    { value: 'dots', label: 'Dots', Wireframe: SpacerDots },
    { value: 'gradient', label: 'Gradient', Wireframe: SpacerGradient },
  ],
  featureGrid: [
    { value: 'iconTop', label: 'Icon on top', Wireframe: FeatureIconTop },
    { value: 'iconLeft', label: 'Icon on left', Wireframe: FeatureIconLeft },
    { value: 'cards', label: 'Cards', Wireframe: FeatureCards },
    { value: 'minimal', label: 'Minimal', Wireframe: FeatureMinimal },
  ],
  steps: [
    { value: 'horizontal', label: 'Horizontal', Wireframe: StepsHorizontal },
    { value: 'vertical', label: 'Vertical timeline', Wireframe: StepsVertical },
    { value: 'cards', label: 'Cards', Wireframe: StepsCards },
    { value: 'compact', label: 'Compact list', Wireframe: StepsCompact },
  ],
  logoStrip: [
    { value: 'staticRow', label: 'Static row', Wireframe: LogoStaticRow },
    { value: 'grid', label: 'Grid', Wireframe: LogoGrid },
    { value: 'marquee', label: 'Marquee', Wireframe: LogoMarquee },
    { value: 'bordered', label: 'Bordered', Wireframe: LogoBordered },
  ],
  videoEmbed: [
    { value: 'contained', label: 'Contained', Wireframe: VideoContained },
    { value: 'fullBleed', label: 'Full bleed', Wireframe: VideoFullBleed },
    { value: 'sideBySide', label: 'Side by side', Wireframe: VideoSideBySide },
    { value: 'textOverlay', label: 'Text overlay', Wireframe: VideoTextOverlay },
  ],
  contact: [
    { value: 'mapSplit', label: 'Map + details (split)', Wireframe: ContactMapSplit },
    { value: 'mapStacked', label: 'Details, map below', Wireframe: ContactMapStacked },
    { value: 'detailsOnly', label: 'Details only', Wireframe: ContactDetailsOnly },
    { value: 'banner', label: 'Compact banner', Wireframe: ContactBanner },
  ],
  featuredProduct: [
    { value: 'imageLeft', label: 'Image left', Wireframe: FeaturedImageLeft },
    { value: 'imageRight', label: 'Image right', Wireframe: FeaturedImageRight },
    { value: 'overlay', label: 'Overlay', Wireframe: FeaturedOverlay },
    { value: 'stacked', label: 'Stacked', Wireframe: FeaturedStacked },
  ],
  categoryPreviews: [
    { value: 'grid', label: 'Grid', Wireframe: CategoryGrid },
    { value: 'overlayCards', label: 'Overlay cards', Wireframe: CategoryOverlay },
    { value: 'list', label: 'List', Wireframe: CategoryList },
  ],
  promoSection: [
    { value: 'splitImage', label: 'Split image', Wireframe: PromoSplit },
    { value: 'overlay', label: 'Full-bleed overlay', Wireframe: PromoOverlay },
    { value: 'bannerStrip', label: 'Compact banner', Wireframe: PromoBanner },
  ],
  reviews: [
    { value: 'cards', label: 'Cards', Wireframe: ReviewCards },
    { value: 'list', label: 'List', Wireframe: ReviewList },
    { value: 'masonry', label: 'Masonry', Wireframe: ReviewMasonry },
  ],
  productGrid: [
    { value: 'grid', label: 'Grid', Wireframe: PGGrid },
    { value: 'carousel', label: 'Carousel', Wireframe: PGCarousel },
    { value: 'list', label: 'List', Wireframe: PGList },
  ],
  ticker: [
    { value: 'static', label: 'Static row', Wireframe: TickerStatic },
    { value: 'marquee', label: 'Marquee', Wireframe: TickerMarquee },
  ],
  storyStats: [
    { value: 'imageLeft', label: 'Image left', Wireframe: StoryImageLeft },
    { value: 'imageRight', label: 'Image right', Wireframe: StoryImageRight },
  ],
  mediaHero: [
    { value: 'split', label: 'Split card', Wireframe: MediaHeroSplit },
    { value: 'overlay', label: 'Full-bleed overlay', Wireframe: MediaHeroOverlay },
  ],
}
