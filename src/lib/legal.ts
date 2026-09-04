/**
 * Single source of truth for the version of the Terms of Service / Acceptable
 * Use Policy currently in force. Bump this (to the date the policy text changed)
 * whenever the terms page is materially revised, so `tenants.termsAcceptedVersion`
 * records exactly which version each owner agreed to at signup.
 *
 * Referenced by the signup action (records it) and the terms page (displays it),
 * so the two can never drift.
 */
export const CURRENT_TERMS_VERSION = '2026-08-06'
