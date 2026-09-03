'use client'

import React, { useState } from 'react'
import type { CredentialFieldSpec } from '@/payments/core/types'
import type { MaskedCredentials } from '@/payments/security/credential-encryption'
import '@/components/admin/brand/admin-brand.css'

export interface ProviderVM {
  slug: string
  label: string
  kind: 'hosted' | 'offline'
  credentialSchema: CredentialFieldSpec[]
  enabled: boolean
  environment: 'test' | 'live'
  configured: boolean
  masked: MaskedCredentials
  webhookUrl: string
}

interface Props {
  tenantId: string | number
  providers: ProviderVM[]
}

export default function PaymentsSettingsClient({ tenantId, providers }: Props) {
  return (
    <>
      <h1 style={{ marginBottom: '0.5rem' }}>Payments</h1>
      <p style={noticeStyle}>
        Your customers pay through your connected payment provider. Payments and payouts are handled
        directly by the provider. Niblr does not hold your funds.
      </p>
      {providers.map((vm) => (
        <ProviderCard key={vm.slug} tenantId={tenantId} vm={vm} />
      ))}
      <RequestProviderCard tenantId={tenantId} />
    </>
  )
}

function RequestProviderCard({ tenantId }: { tenantId: string | number }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  async function submit() {
    if (!name.trim()) {
      setMsg({ kind: 'err', text: 'Please name the provider you want.' })
      return
    }
    setSubmitting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/payments/request-provider', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId, providerName: name.trim(), note: note.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) setMsg({ kind: 'err', text: data.error ?? 'Could not submit.' })
      else {
        setMsg({ kind: 'ok', text: data.message ?? 'Request submitted.' })
        setName('')
        setNote('')
      }
    } catch {
      setMsg({ kind: 'err', text: 'Network error.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section style={{ ...cardStyle, borderStyle: 'dashed' }}>
      <h2 style={{ margin: '0 0 0.25rem' }}>Don&rsquo;t see your provider?</h2>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.9em', color: 'var(--theme-elevation-500)' }}>
        Tell us which payment provider you&rsquo;d like us to add and we&rsquo;ll prioritise it.
      </p>
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={labelStyle}>Provider name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PayPal, Mercado Pago" style={inputStyle} />
      </div>
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={labelStyle}>Notes (optional)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Country, why you need it, volume…" style={inputStyle} />
      </div>
      {msg && <p style={{ ...msgStyle(msg.kind), marginTop: 0, marginBottom: '0.75rem' }}>{msg.text}</p>}
      <button type="button" onClick={submit} disabled={submitting} style={secondaryBtn}>
        {submitting ? 'Submitting…' : 'Request provider'}
      </button>
    </section>
  )
}

type Msg = { kind: 'ok' | 'err' | 'warn'; text: string } | null

function ProviderCard({ tenantId, vm }: { tenantId: string | number; vm: ProviderVM }) {
  const [enabled, setEnabled] = useState(vm.enabled)
  const [environment, setEnvironment] = useState<'test' | 'live'>(vm.environment)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const setField = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }))

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/payments/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId, provider: vm.slug, enabled, environment, credentials: values }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) setMsg({ kind: 'err', text: data.error ?? 'Could not save.' })
      else {
        setMsg({ kind: 'ok', text: 'Saved.' })
        setValues({})
      }
    } catch {
      setMsg({ kind: 'err', text: 'Network error while saving.' })
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/payments/test-connection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId, provider: vm.slug }),
      })
      const data = await res.json()
      if (data.ok) {
        const warnings: string[] = data.warnings ?? []
        setMsg({
          kind: warnings.length ? 'warn' : 'ok',
          text: [data.message, ...warnings].filter(Boolean).join(' — '),
        })
      } else {
        setMsg({ kind: 'err', text: data.message ?? data.error ?? 'Connection test failed.' })
      }
    } catch {
      setMsg({ kind: 'err', text: 'Network error during test.' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <section style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {vm.label}
          <span style={badgeStyle}>{vm.kind === 'offline' ? 'Offline' : 'Hosted'}</span>
          {vm.configured && <span style={{ ...badgeStyle, background: 'var(--nb-brand-soft)', color: 'var(--nb-brand)' }}>Configured</span>}
        </h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9em' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
      </div>

      {vm.kind === 'hosted' && (
        <div style={{ marginTop: '0.75rem' }}>
          <label style={labelStyle}>Environment</label>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as 'test' | 'live')}
            style={inputStyle}
          >
            <option value="test">Test</option>
            <option value="live">Live</option>
          </select>
        </div>
      )}

      {vm.credentialSchema.map((f) => (
        <CredentialField
          key={f.name}
          field={f}
          configured={vm.masked[f.name]?.configured ?? false}
          initialValue={vm.masked[f.name]?.value ?? ''}
          onChange={(val) => setField(f.name, val)}
        />
      ))}

      {vm.kind === 'hosted' && vm.webhookUrl && (
        <div style={{ marginTop: '0.75rem' }}>
          <label style={labelStyle}>Webhook URL (register this in your provider dashboard)</label>
          <code style={{ ...codeStyle }}>{vm.webhookUrl}</code>
        </div>
      )}

      {msg && <p style={msgStyle(msg.kind)}>{msg.text}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button type="button" onClick={save} disabled={saving} style={primaryBtn}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {vm.kind === 'hosted' && (
          <button type="button" onClick={test} disabled={testing || !vm.configured} style={secondaryBtn}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
        )}
      </div>
    </section>
  )
}

function CredentialField({
  field,
  configured,
  initialValue,
  onChange,
}: {
  field: CredentialFieldSpec
  configured: boolean
  initialValue: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ marginTop: '0.75rem' }}>
      <label style={labelStyle}>
        {field.label}
        {field.required && <span style={{ color: 'var(--theme-error-500, #dc2626)' }}> *</span>}
      </label>
      <input
        type={field.secret ? 'password' : 'text'}
        defaultValue={field.secret ? '' : initialValue}
        placeholder={field.secret && configured ? '•••••••• (leave blank to keep current)' : ''}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
        autoComplete="off"
      />
      {field.help && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8em', color: 'var(--theme-elevation-500)' }}>{field.help}</p>}
    </div>
  )
}

/** Message pill colors, keyed by kind — all theme-var based (dark-safe). */
function msgStyle(kind: 'ok' | 'warn' | 'err'): React.CSSProperties {
  const map = {
    ok: ['var(--theme-success-100)', 'var(--theme-success-600)'],
    warn: ['var(--theme-warning-100)', 'var(--theme-warning-600)'],
    err: ['var(--theme-error-100)', 'var(--theme-error-600)'],
  } as const
  const [bg, color] = map[kind]
  return {
    marginTop: '0.75rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    fontSize: '0.9em',
    background: bg,
    color,
  }
}

const noticeStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: '12px',
  background: 'var(--nb-brand-soft)',
  border: '1px solid var(--nb-brand)',
  color: 'var(--theme-text)',
  marginBottom: '1.5rem',
  fontSize: '0.9em',
}
const cardStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '12px',
  background: 'var(--theme-elevation-0)',
  padding: '1.25rem',
  marginBottom: '1.25rem',
}
const badgeStyle: React.CSSProperties = {
  fontSize: '0.65em',
  fontWeight: 700,
  textTransform: 'uppercase',
  padding: '2px 8px',
  borderRadius: '999px',
  background: 'var(--theme-elevation-100)',
  color: 'var(--theme-elevation-600)',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.85em',
  fontWeight: 600,
  marginBottom: '0.25rem',
  color: 'var(--theme-text)',
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.6rem',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '8px',
  fontSize: '0.9em',
  background: 'var(--theme-input-bg, transparent)',
  color: 'var(--theme-text)',
}
const codeStyle: React.CSSProperties = {
  display: 'block',
  padding: '0.5rem 0.6rem',
  background: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '8px',
  fontSize: '0.8em',
  color: 'var(--theme-text)',
  wordBreak: 'break-all',
}
const primaryBtn: React.CSSProperties = {
  padding: '0.5rem 1.1rem',
  border: '1px solid var(--nb-brand)',
  borderRadius: 'var(--nb-radius-btn, 9px)',
  background: 'var(--nb-brand)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
}
const secondaryBtn: React.CSSProperties = {
  padding: '0.5rem 1.1rem',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--nb-radius-btn, 9px)',
  background: 'var(--theme-elevation-0)',
  color: 'var(--theme-text)',
  fontWeight: 600,
  cursor: 'pointer',
}
