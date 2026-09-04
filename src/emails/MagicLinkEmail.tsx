import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { NiblrEmailLayout } from './NiblrEmailLayout'

export function MagicLinkEmail({ magicUrl, storeName }: { magicUrl: string; storeName: string }) {
  return (
    <NiblrEmailLayout preview={`Sign in to ${storeName}`}>
      <Heading style={{ fontSize: 22, color: '#171717', margin: '0 0 8px' }}>Sign in to {storeName}</Heading>
      <Text style={{ fontSize: 15, color: '#374151', lineHeight: '1.6' }}>
        Click the button below to sign in. This link expires in 15 minutes and can be used once.
      </Text>
      <Button href={magicUrl} style={{ backgroundColor: '#171717', color: '#fff', borderRadius: 8, padding: '12px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
        Sign in
      </Button>
      <Text style={{ fontSize: 13, color: '#5b6169', marginTop: 16, wordBreak: 'break-all' }}>{magicUrl}</Text>
      <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 16 }}>If you didn’t request this, you can ignore this email.</Text>
    </NiblrEmailLayout>
  )
}

MagicLinkEmail.PreviewProps = { magicUrl: 'https://niblr.store/account/magic/confirm?token=demo', storeName: 'Niblr' }
export default MagicLinkEmail
