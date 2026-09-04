import * as React from 'react'
import { Heading, Text, Row, Column, Section, Hr } from '@react-email/components'
import { NiblrEmailLayout } from './NiblrEmailLayout'
import { formatMoney } from '@/lib/money'
import { formatFulfilmentSummary } from '@/lib/fulfillment'
import type { Order } from '@/payload-types'

export function OrderConfirmationEmail({ order }: { order: Order }) {
  const orderNo = order.orderNumber ?? `#${order.id}`
  const summary = formatFulfilmentSummary(order.fulfillment ?? {})
  const addr = order.shippingAddress
  return (
    <NiblrEmailLayout preview={`Order ${orderNo} confirmed`}>
      <Heading style={{ fontSize: 22, color: '#171717', margin: '0 0 4px' }}>Thank you, {addr.name}!</Heading>
      <Text style={{ fontSize: 15, color: '#374151' }}>Your order <strong>{orderNo}</strong> is confirmed.</Text>
      <Hr style={{ borderColor: '#e6e8ec', margin: '16px 0' }} />
      {order.lineItems.map((l, i) => (
        <Row key={i} style={{ fontSize: 14, color: '#374151' }}>
          <Column>{l.title}{l.variantTitle ? ` — ${l.variantTitle}` : ''} × {l.qty}</Column>
          <Column style={{ textAlign: 'right' }}>{formatMoney(l.lineTotal, order.currency)}</Column>
        </Row>
      ))}
      <Hr style={{ borderColor: '#e6e8ec', margin: '12px 0' }} />
      <Row style={{ fontSize: 15, fontWeight: 700, color: '#171717' }}>
        <Column>Order total</Column>
        <Column style={{ textAlign: 'right' }}>{formatMoney(order.total, order.currency)}</Column>
      </Row>
      {summary ? (
        <Section style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: 700, color: '#171717', margin: '0 0 4px' }}>{order.fulfillment?.method === 'pickup' ? 'Collection' : 'Delivery'}</Text>
          <Text style={{ fontSize: 14, color: '#374151', margin: 0 }}>{summary}</Text>
        </Section>
      ) : null}
      <Section style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: 700, color: '#171717', margin: '0 0 4px' }}>{order.fulfillment?.method === 'pickup' ? 'Pickup point' : 'Shipping address'}</Text>
        <Text style={{ fontSize: 14, color: '#374151', margin: 0 }}>
          {[addr.name, addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean).join(', ')}
        </Text>
      </Section>
    </NiblrEmailLayout>
  )
}

OrderConfirmationEmail.PreviewProps = {
  order: {
    id: 1, email: 'buyer@example.com', orderNumber: 'ORD-1001', currency: 'INR', total: 150000,
    lineItems: [
      { title: 'Chocolate Cake', variantTitle: '1kg', qty: 2, unitPrice: 50000, lineTotal: 100000 },
      { title: 'Cupcake Box', qty: 1, unitPrice: 50000, lineTotal: 50000 },
    ],
    shippingAddress: { name: 'Jordan Lee', line1: '12 Baker St', city: 'Dubai', postalCode: '00000', country: 'AE' },
    fulfillment: {},
  } as unknown as Order,
}
export default OrderConfirmationEmail
