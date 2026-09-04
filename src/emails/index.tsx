import * as React from 'react'
import type { Order } from '@/payload-types'
import { renderEmail } from './render'
import { WelcomeEmail } from './WelcomeEmail'
import { VerifyEmail } from './VerifyEmail'
import { PasswordResetEmail } from './PasswordResetEmail'
import { OrderConfirmationEmail } from './OrderConfirmationEmail'
import { InvoiceEmail } from './InvoiceEmail'
import { MagicLinkEmail } from './MagicLinkEmail'

export const renderWelcome = (p: { storeName: string; slug: string }) => renderEmail(<WelcomeEmail {...p} />)
export const renderVerify = (p: { verifyUrl: string }) => renderEmail(<VerifyEmail {...p} />)
export const renderPasswordReset = (p: { resetUrl: string; storeName: string }) => renderEmail(<PasswordResetEmail {...p} />)
export const renderOrderConfirmation = (order: Order) => renderEmail(<OrderConfirmationEmail order={order} />)
export const renderInvoice = (p: { invoiceNo: string; storeName: string; orderNumber: string; total: string; isTaxInvoice?: boolean }) => renderEmail(<InvoiceEmail {...p} />)
export const renderMagicLink = (p: { magicUrl: string; storeName: string }) => renderEmail(<MagicLinkEmail {...p} />)
