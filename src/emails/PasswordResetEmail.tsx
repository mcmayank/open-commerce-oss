import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { NiblrEmailLayout } from './NiblrEmailLayout'

export function PasswordResetEmail({ resetUrl, storeName }: { resetUrl: string; storeName: string }) {
  return (
    <NiblrEmailLayout preview={`Reset your ${storeName} password`}>
      <Heading style={{ fontSize: 22, color: '#171717', margin: '0 0 8px' }}>Reset your password</Heading>
      <Text style={{ fontSize: 15, color: '#374151', lineHeight: '1.6' }}>
        We received a request to reset the password for your {storeName} account. This link expires in 1 hour.
      </Text>
      <Button href={resetUrl} style={{ backgroundColor: '#171717', color: '#fff', borderRadius: 8, padding: '12px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
        Reset password
      </Button>
      <Text style={{ fontSize: 13, color: '#5b6169', marginTop: 16, wordBreak: 'break-all' }}>{resetUrl}</Text>
      <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 16 }}>If you didn’t request this, you can ignore this email.</Text>
    </NiblrEmailLayout>
  )
}

PasswordResetEmail.PreviewProps = { resetUrl: 'https://niblr.store/admin/reset/demo', storeName: 'Niblr' }
export default PasswordResetEmail
