import * as React from 'react'
import { Heading, Text } from '@react-email/components'
import { NiblrEmailLayout } from './NiblrEmailLayout'

/**
 * `isTaxInvoice` mirrors the PDF: the document is only called a Tax Invoice
 * when the store had a TRN at the time of the order. The email title and the
 * attachment must agree — a customer who sees "Invoice" in the mail and
 * "Tax Invoice" on the PDF has no idea which one their accountant wants.
 */
export function InvoiceEmail({ invoiceNo, storeName, orderNumber, total, isTaxInvoice = false }: { invoiceNo: string; storeName: string; orderNumber: string; total: string; isTaxInvoice?: boolean }) {
  const title = isTaxInvoice ? 'Tax invoice' : 'Invoice'
  return (
    <NiblrEmailLayout preview={`${title} ${invoiceNo} from ${storeName}`}>
      <Heading style={{ fontSize: 22, color: '#171717', margin: '0 0 8px' }}>{title} {invoiceNo}</Heading>
      <Text style={{ fontSize: 15, color: '#374151' }}>From <strong>{storeName}</strong> · Order {orderNumber}</Text>
      <Text style={{ fontSize: 15, color: '#374151' }}>Amount: <strong>{total}</strong></Text>
      <Text style={{ fontSize: 13, color: '#5b6169', marginTop: 12 }}>Your invoice is attached as a PDF. Thank you for your order.</Text>
    </NiblrEmailLayout>
  )
}

InvoiceEmail.PreviewProps = { invoiceNo: 'INV-7', storeName: 'Acme Co', orderNumber: 'ORD-1001', total: '₹1,500.00' }
export default InvoiceEmail
