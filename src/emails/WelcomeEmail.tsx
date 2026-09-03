import * as React from 'react'
import { Button, Heading, Link, Text } from '@react-email/components'
import { NiblrEmailLayout } from './NiblrEmailLayout'
import { EMAIL_BASE_URL } from './render'

export function WelcomeEmail({ storeName, slug }: { storeName: string; slug: string }) {
  // The store lives on its own subdomain of the platform root (e.g. acme.niblr.store).
  const proto = EMAIL_BASE_URL.startsWith('http://') ? 'http://' : 'https://'
  const rootHost = EMAIL_BASE_URL.replace(/^https?:\/\//, '')
  const storeHost = `${slug}.${rootHost}`
  const storeBase = `${proto}${storeHost}`
  return (
    <NiblrEmailLayout preview={`Welcome to Niblr, ${storeName}`}>
      <Heading style={{ fontSize: 22, color: '#171717', margin: '0 0 8px' }}>Welcome to Niblr</Heading>
      <Text style={{ fontSize: 15, color: '#374151', lineHeight: '1.6' }}>
        <strong>{storeName}</strong> is ready. Build your catalog, set your payment keys, and go live — your store, your data.
      </Text>
      <Button href={`${storeBase}/admin`} style={{ backgroundColor: '#4664AF', color: '#fff', borderRadius: 8, padding: '12px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
        Open your admin
      </Button>
      <Text style={{ fontSize: 13, color: '#5b6169', marginTop: 16 }}>
        Your store address:{' '}
        <Link href={storeBase} style={{ color: '#4664AF', textDecoration: 'underline' }}>
          {storeHost}
        </Link>
      </Text>
    </NiblrEmailLayout>
  )
}

WelcomeEmail.PreviewProps = { storeName: 'Acme Co', slug: 'acme' }
export default WelcomeEmail
