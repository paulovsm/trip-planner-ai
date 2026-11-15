export type DomainErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"

const STATUS: Record<DomainErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 400,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
}

/** Expected, user-facing failure. Anything else is treated as a 500. */
export class DomainError extends Error {
  readonly status: number
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = "DomainError"
    this.status = STATUS[code]
  }
}

export const notFound = (what = "Recurso") => new DomainError("NOT_FOUND", `${what} não encontrado`)
export const conflict = (message: string) => new DomainError("CONFLICT", message)
export const validation = (message: string, details?: unknown) =>
  new DomainError("VALIDATION", message, details)
