export interface SetupLink {
  href: string
  label: string
  icon: string
}

/** OSS build: no plans, no voice assistant, no platform admin. */
export const EXTRA_SETUP_LINKS: SetupLink[] = []
export const HAS_PLATFORM_ADMIN = false
