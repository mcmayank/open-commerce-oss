/**
 * Typed payment errors. Every failure mode the payment domain can surface has
 * a stable machine-readable `code` so callers (webhook route, checkout, admin
 * API) can branch on the code, and so audit logs record the code — never the
 * underlying provider object or any secret.
 */

export type PaymentErrorCode =
  // Configuration / registry
  | 'PROVIDER_NOT_FOUND'
  | 'PROVIDER_DISABLED'
  | 'PROVIDER_MISMATCH'
  | 'UNSUPPORTED_CURRENCY'
  | 'CONFIG_NOT_FOUND'
  // Credentials
  | 'CREDENTIAL_DECRYPTION_FAILED'
  | 'CREDENTIAL_VALIDATION_FAILED'
  // Webhook / reconciliation
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'WEBHOOK_STORE_MISMATCH'
  | 'ATTEMPT_NOT_FOUND'
  | 'PAYMENT_CURRENCY_MISMATCH'
  | 'PAYMENT_AMOUNT_MISMATCH'
  | 'PAYMENT_NOT_SUCCEEDED'
  // Offline
  | 'OFFLINE_NO_RETRIEVE'
  // Generic
  | 'PROVIDER_UNAVAILABLE'

export class PaymentError extends Error {
  readonly code: PaymentErrorCode

  constructor(code: PaymentErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'PaymentError'
    this.code = code
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, PaymentError.prototype)
  }
}

/** Narrowing helper. */
export function isPaymentError(err: unknown): err is PaymentError {
  return err instanceof PaymentError
}
