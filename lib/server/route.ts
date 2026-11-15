import "server-only"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { DomainError } from "@/lib/domain/errors"
import { requireUser, type SessionUser } from "./authz"
import { clientIp, enforceRateLimit, hashIp, type RateLimitBucket } from "./rate-limit"

type Schema = z.ZodType
type Out<S> = S extends z.ZodType ? z.infer<S> : undefined

type Options<P, Q, B, A extends "user" | "public"> = {
  auth: A
  params?: P
  query?: Q
  body?: B
  /** Max JSON body size in bytes (default 64 KB). */
  maxBodyBytes?: number
  rateLimit?: RateLimitBucket
}

type Context<P, Q, B, A> = {
  req: NextRequest
  params: Out<P>
  query: Out<Q>
  body: Out<B>
  user: A extends "user" ? SessionUser : null
}

type RouteProps = { params: Promise<Record<string, string | string[]>> }

const DEFAULT_MAX_BODY = 64 * 1024

/** JSON response helper for non-200 success statuses. */
export const json = (data: unknown, status = 200) => NextResponse.json(data, { status })

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof DomainError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    )
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Dados inválidos", details: z.flattenError(err) } },
      { status: 400 },
    )
  }
  console.error("[api] unexpected error", err)
  return NextResponse.json({ error: { code: "INTERNAL", message: "Erro interno" } }, { status: 500 })
}

async function readJson(req: NextRequest, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? 0)
  if (declared > maxBytes) throw new DomainError("PAYLOAD_TOO_LARGE", "Requisição muito grande")
  const text = await req.text()
  if (Buffer.byteLength(text) > maxBytes) throw new DomainError("PAYLOAD_TOO_LARGE", "Requisição muito grande")
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new DomainError("VALIDATION", "JSON inválido")
  }
}

/**
 * Every API route goes through this wrapper (enforced by tests/unit/architecture.test.ts):
 * authentication, zod validation of params/query/body, body size limit, rate limiting,
 * and uniform error responses. Authorization on a Trip is done in the handler via
 * requireTripAccess (or inside the command's transaction).
 */
export function withRoute<
  P extends Schema | undefined = undefined,
  Q extends Schema | undefined = undefined,
  B extends Schema | undefined = undefined,
  A extends "user" | "public" = "user",
>(opts: Options<P, Q, B, A>, handler: (ctx: Context<P, Q, B, A>) => Promise<unknown>) {
  return async (req: NextRequest, props: RouteProps): Promise<Response> => {
    try {
      const user = opts.auth === "user" ? await requireUser() : null

      if (opts.rateLimit) {
        const key = user ? user.id : hashIp(clientIp(req.headers))
        await enforceRateLimit(opts.rateLimit, key)
      }

      const rawParams = (await props?.params) ?? {}
      const params = opts.params ? opts.params.parse(rawParams) : undefined
      const query = opts.query ? opts.query.parse(Object.fromEntries(req.nextUrl.searchParams)) : undefined
      const body = opts.body ? opts.body.parse(await readJson(req, opts.maxBodyBytes ?? DEFAULT_MAX_BODY)) : undefined

      const result = await handler({ req, params, query, body, user } as Context<P, Q, B, A>)
      if (result instanceof Response) return result
      return result === undefined ? new NextResponse(null, { status: 204 }) : NextResponse.json(result)
    } catch (err) {
      return errorResponse(err)
    }
  }
}
