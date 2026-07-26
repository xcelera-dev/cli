import isNetworkError from 'is-network-error'

import {
  ApiError,
  ApiResponse,
  AuditPayload,
  AuditSelector,
  AuthCredentials,
  BuildContext,
  ErrorResponse,
  GithubIntegrationContext,
  SuccessResponse
} from '../types/index.js'

export type ApiFailure = ErrorResponse<ApiError> & {
  /** Seconds the server asked us to wait, from Retry-After on a 429. */
  retryAfterSeconds?: number
}

export type ApiResult<T> = SuccessResponse<T> | ApiFailure

export type AuditData = {
  auditId: string
  url: string
  status: string
  page: {
    id: string
    name: string | null
    ref: string
  }
  integrations?: {
    github?: GithubIntegrationContext
  }
}

export type RequestOptions = {
  token: string
  query?: Record<string, string | undefined>
  body?: unknown
}

/**
 * Every API call goes through here: base URL, bearer auth, the
 * `{success, data | error}` envelope, and network/transport failures mapped to
 * the same `{code, message, hint?, details?}` shape the API itself returns.
 * Never throws — commands print the error and pick an exit code.
 */
export async function request<T>(
  method: string,
  path: string,
  { token, query, body }: RequestOptions
): Promise<ApiResult<T>> {
  const url = new URL(path, getApiBaseUrl())
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value)
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })

    if (!response.ok) {
      return await toFailure(response)
    }

    const text = await response.text()
    try {
      const { data } = JSON.parse(text) as SuccessResponse<T>
      return { success: true, data }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'invalid_response',
          message: 'The API returned a malformed response.',
          details: error instanceof Error ? error.message : String(error)
        }
      }
    }
  } catch (error) {
    if (isNetworkError(error)) {
      return {
        success: false,
        error: {
          code: 'network_error',
          message: 'Could not reach the xcelera API.',
          hint: 'Check your network connection, or set XCELERA_API_URL if you are pointing at a different host.',
          details: error.message
        }
      }
    }
    throw error
  }
}

export async function requestAudit(
  ref: string,
  token: string,
  context: BuildContext,
  auth?: AuthCredentials
): Promise<ApiResult<AuditData>> {
  return request<AuditData>('POST', '/api/v1/audits', {
    token,
    body: { ref, context, ...(auth && { auth }) }
  })
}

export async function getAudit(
  token: string,
  selector: AuditSelector
): Promise<ApiResult<AuditPayload>> {
  if (selector.auditId) {
    return request<AuditPayload>(
      'GET',
      `/api/v1/audits/${encodeURIComponent(selector.auditId)}`,
      { token }
    )
  }

  return request<AuditPayload>('GET', '/api/v1/audits', {
    token,
    query: {
      ref: selector.ref,
      gitHash: selector.gitHash,
      prNumber: selector.prNumber
    }
  })
}

async function toFailure(response: Response): Promise<ApiFailure> {
  const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'))
  const text = await response.text()

  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = JSON.parse(text) as ApiResponse<unknown, ApiError>
      if (body.success === false) {
        return { success: false, error: body.error, retryAfterSeconds }
      }
    } catch {
      // Fall through to the generic shape below.
    }
  }

  // Anything the API did not shape itself: a proxy error page, a plain-text
  // 429 from the edge rate limiter, an unhandled 500.
  return {
    success: false,
    error: {
      code: response.status === 429 ? 'rate_limited' : 'http_error',
      message: `Request failed: ${response.status} ${response.statusText}`,
      details: text
    },
    retryAfterSeconds
  }
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
}

function getApiBaseUrl(): string {
  return process.env.XCELERA_API_URL || 'https://xcelera.dev'
}
