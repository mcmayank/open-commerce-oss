import * as React from 'react'
import { Body, Container, Head, Hr, Html, Img, Preview, Section, Text } from '@react-email/components'
import { EMAIL_BASE_URL } from './render'

const INK = '#171717'
const CLOUD = '#f7f8fa'
const MUTED = '#5b6169'

export function NiblrEmailLayout({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: CLOUD, fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: '24px 0' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: 12, maxWidth: 560, margin: '0 auto', padding: 32 }}>
          <Section>
            <Img src={`${EMAIL_BASE_URL}/niblr-email-logo.png`} width="36" height="36" alt="Niblr" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
            <Text style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 0 0 10px', fontSize: 20, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>niblr</Text>
          </Section>
          <Hr style={{ borderColor: '#e6e8ec', margin: '20px 0' }} />
          {children}
          <Hr style={{ borderColor: '#e6e8ec', margin: '24px 0 12px' }} />
          <Text style={{ fontSize: 12, color: MUTED, margin: 0 }}>Niblr — build stores, ship faster.</Text>
        </Container>
      </Body>
    </Html>
  )
}
