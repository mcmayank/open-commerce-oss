import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { InvoiceData } from './data'

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#15181d', fontFamily: 'Helvetica' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  h1: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
  muted: { color: '#5b6169' },
  section: { marginTop: 18 },
  th: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#dbded8', paddingBottom: 4, fontFamily: 'Helvetica-Bold' },
  td: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderColor: '#eef0ec' },
  cItem: { flex: 3 }, cQty: { flex: 1, textAlign: 'right' }, cAmt: { flex: 1, textAlign: 'right' },
  totals: { marginTop: 12, alignSelf: 'flex-end', width: '45%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grand: { fontFamily: 'Helvetica-Bold', fontSize: 12, borderTopWidth: 1, borderColor: '#dbded8', marginTop: 4, paddingTop: 4 },
  logo: { height: 28, marginBottom: 6, objectFit: 'contain' },
})

function InvoiceDocument({ data }: { data: InvoiceData }) {
  const date = new Date(data.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.row}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's
                <Image> renders into a PDF, which has no alt attribute; the rule is
                matching on the element name, not an HTML image. */}
            {data.logoUrl ? <Image src={data.logoUrl} style={s.logo} /> : null}
            <Text style={s.h1}>{data.storeName}</Text>
            {/* The TRN belongs in the supplier block on a UAE tax invoice. */}
            {data.supplierTrn ? <Text style={s.muted}>TRN: {data.supplierTrn}</Text> : null}
          </View>
          <View style={{ textAlign: 'right' }}>
            {/* "Tax Invoice" is used only when a TRN is present — the heading
                without the number is itself non-compliant. */}
            <Text style={s.h1}>{data.isTaxInvoice ? 'TAX INVOICE' : 'INVOICE'}</Text>
            <Text style={s.muted}>{data.invoiceNumber}</Text>
            <Text style={s.muted}>{date}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.muted}>Bill to</Text>
          <Text>{data.billTo.name ?? data.billTo.email}</Text>
          {data.billTo.name ? <Text style={s.muted}>{data.billTo.email}</Text> : null}
          {data.billTo.line1 ? <Text>{data.billTo.line1}</Text> : null}
          {data.billTo.line2 ? <Text>{data.billTo.line2}</Text> : null}
          <Text>{[data.billTo.city, data.billTo.state, data.billTo.postalCode].filter(Boolean).join(', ')}</Text>
          {data.billTo.country ? <Text>{data.billTo.country}</Text> : null}
          <Text style={[s.muted, { marginTop: 6 }]}>Order {data.orderNumber} · {data.status}</Text>
        </View>

        <View style={s.section}>
          <View style={s.th}>
            <Text style={s.cItem}>Item</Text>
            <Text style={s.cQty}>Qty</Text>
            <Text style={s.cAmt}>Unit</Text>
            <Text style={s.cAmt}>Amount</Text>
          </View>
          {data.lines.map((l, i) => (
            <View style={s.td} key={i}>
              <Text style={s.cItem}>{l.title}{l.variantTitle ? ` — ${l.variantTitle}` : ''}</Text>
              <Text style={s.cQty}>{l.qty}</Text>
              <Text style={s.cAmt}>{l.unitPrice}</Text>
              <Text style={s.cAmt}>{l.lineTotal}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals}>
          <View style={s.totalRow}><Text style={s.muted}>Subtotal</Text><Text>{data.subtotal}</Text></View>
          {data.discount ? <View style={s.totalRow}><Text style={s.muted}>Discount</Text><Text>-{data.discount}</Text></View> : null}
          {data.shipping ? <View style={s.totalRow}><Text style={s.muted}>Shipping</Text><Text>{data.shipping}</Text></View> : null}
          {data.taxableAmount ? <View style={s.totalRow}><Text style={s.muted}>Taxable amount</Text><Text>{data.taxableAmount}</Text></View> : null}
          {data.tax ? <View style={s.totalRow}><Text style={s.muted}>{data.taxLabel ?? 'Tax'}</Text><Text>{data.tax}</Text></View> : null}
          <View style={[s.totalRow, s.grand]}><Text>Total</Text><Text>{data.total}</Text></View>
        </View>
      </Page>
    </Document>
  )
}

/** Render an invoice to a PDF Buffer (server-side; no headless browser). */
export async function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />)
}
