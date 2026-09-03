/**
 * Provider registry — the ONLY place that maps a slug to an adapter.
 *
 * Adding a provider is: create `payments/providers/<id>/`, export the adapter,
 * and register it here. Nothing else in the codebase may branch on a slug.
 */
import type { PaymentProvider } from './types'
import { PaymentError } from './errors'
import { stripeProvider } from '@/payments/providers/stripe'
import { razorpayProvider } from '@/payments/providers/razorpay'
import { offlineProvider } from '@/payments/providers/offline'
import { mollieProvider } from '@/payments/providers/mollie'
import { paystackProvider } from '@/payments/providers/paystack'
import { flutterwaveProvider } from '@/payments/providers/flutterwave'
import { xenditProvider } from '@/payments/providers/xendit'

const REGISTRY: Record<string, PaymentProvider> = {
  [stripeProvider.slug]: stripeProvider,
  [razorpayProvider.slug]: razorpayProvider,
  [mollieProvider.slug]: mollieProvider,
  [paystackProvider.slug]: paystackProvider,
  [flutterwaveProvider.slug]: flutterwaveProvider,
  [xenditProvider.slug]: xenditProvider,
  [offlineProvider.slug]: offlineProvider,
}

/** Look up a provider by slug. Returns null for unknown slugs. */
export function getProvider(slug: string): PaymentProvider | null {
  return REGISTRY[slug] ?? null
}

/** Look up a provider or throw a typed error. */
export function requireProvider(slug: string): PaymentProvider {
  const provider = getProvider(slug)
  if (!provider) throw new PaymentError('PROVIDER_NOT_FOUND', `Unknown payment provider: ${slug}`)
  return provider
}

/** All registered providers, in a stable order. */
export function listProviders(): PaymentProvider[] {
  return Object.values(REGISTRY)
}
