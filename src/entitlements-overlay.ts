import type { Payload } from 'payload'
import { EVERYTHING, type EntitledStore, type Entitlements, type StoreUsage } from '@/entitlements'

/** OSS build: one store, no plans, every capability on. */
export async function resolveOf(_store: EntitledStore): Promise<Entitlements> {
  return EVERYTHING
}

export async function resolveById(
  _payload: Payload,
  _storeId: string | number,
): Promise<Entitlements & { usage: StoreUsage }> {
  return { ...EVERYTHING, usage: { mediaBytesUsed: 0 } }
}

export async function resolveForHost(_payload: Payload, _host: string | null): Promise<Entitlements | null> {
  return EVERYTHING
}
