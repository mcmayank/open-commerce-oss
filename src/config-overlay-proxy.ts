import type { ProxyHandler } from '@/lib/proxy-csp'

/** OSS build: exactly one store, no host resolution. */
export const compose = (core: ProxyHandler): ProxyHandler => core
