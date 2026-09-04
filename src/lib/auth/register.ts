export function classifyRegistration(
  existing: { id: number | string; passwordHash?: string | null } | null,
): 'create' | 'claim' | 'exists' {
  if (!existing) return 'create'
  return existing.passwordHash ? 'exists' : 'claim'
}
