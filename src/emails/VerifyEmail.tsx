import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { NiblrEmailLayout } from './NiblrEmailLayout'

export function VerifyEmail({ verifyUrl }: { verifyUrl: string }) {
  return (
    <NiblrEmailLayout preview="Verify your Niblr email">
      <Heading style={{ fontSize: 22, color: '#171717', margin: '0 0 8px' }}>Verify your email</Heading>
      <Text style={{ fontSize: 15, color: '#374151', lineHeight: '1.6' }}>Confirm this address to finish setting up your Niblr account.</Text>
      <Button href={verifyUrl} style={{ backgroundColor: '#4664AF', color: '#fff', borderRadius: 8, padding: '12px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
        Verify email
      </Button>
      <Text style={{ fontSize: 13, color: '#5b6169', marginTop: 16, wordBreak: 'break-all' }}>{verifyUrl}</Text>
    </NiblrEmailLayout>
  )
}

VerifyEmail.PreviewProps = { verifyUrl: 'https://niblr.store/admin/verify?token=demo' }
export default VerifyEmail
