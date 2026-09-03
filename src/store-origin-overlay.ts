const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'lvh.me:3000'

/** OSS build: the one store lives at the configured root domain itself. */
export function storeOrigin(_slug: string): string {
  const isLocal =
    ROOT_DOMAIN.includes('localhost') || ROOT_DOMAIN.includes('lvh.me') || ROOT_DOMAIN.startsWith('127.')
  return `${isLocal ? 'http' : 'https'}://${ROOT_DOMAIN}`
}
