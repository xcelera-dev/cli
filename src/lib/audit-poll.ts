import { ApiError, AuditPayload, AuditStatus } from '../types/index.js'
import { ApiResult, getAudit } from './api.js'

export type PollTick = {
  status: AuditStatus
  elapsedMs: number
}

export type PollOptions = {
  timeoutSeconds: number
  intervalMs?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  /** Called with each non-terminal status observed, for a live status line. */
  onTick?: (tick: PollTick) => void
}

export type PollResult =
  | { done: true; audit: AuditPayload }
  | { done: false; error: ApiError }

const DEFAULT_INTERVAL_MS = 10_000

// A blip mid-run shouldn't cost the audit, but a misconfigured host shouldn't
// spin until the timeout either. Rate limits are expected and retried freely.
const MAX_CONSECUTIVE_ERRORS = 3

/**
 * Polls one audit until it reaches a terminal status. Always polls by auditId:
 * ref selectors only ever resolve to a succeeded audit, so they can never
 * observe an audit that is still running.
 */
export async function waitForAudit(
  auditId: string,
  token: string,
  options: PollOptions
): Promise<PollResult> {
  const {
    timeoutSeconds,
    intervalMs = DEFAULT_INTERVAL_MS,
    sleep = defaultSleep,
    now = Date.now,
    onTick
  } = options

  const startedAt = now()
  const deadline = startedAt + timeoutSeconds * 1000
  let consecutiveErrors = 0

  for (;;) {
    const response: ApiResult<AuditPayload> = await getAudit(token, {
      auditId
    })

    if (response.success && isTerminal(response.data.status)) {
      return { done: true, audit: response.data }
    }

    let waitMs = intervalMs
    if (!response.success) {
      const { code } = response.error
      if (code === 'rate_limited') {
        waitMs = backoffMs(response.retryAfterSeconds, intervalMs)
      } else if (isTransient(code)) {
        consecutiveErrors += 1
        if (consecutiveErrors > MAX_CONSECUTIVE_ERRORS) {
          return { done: false, error: response.error }
        }
      } else {
        return { done: false, error: response.error }
      }
    } else {
      consecutiveErrors = 0
      onTick?.({
        status: response.data.status,
        elapsedMs: now() - startedAt
      })
    }

    if (now() >= deadline) return { done: false, error: timedOut(auditId) }

    // A large Retry-After shouldn't sleep past the deadline we'd otherwise
    // time out at anyway.
    await sleep(Math.min(waitMs, deadline - now()))
  }
}

function isTerminal(status: AuditPayload['status']): boolean {
  return status === 'Succeeded' || status === 'Failed'
}

function isTransient(code: string): boolean {
  return code === 'network_error' || code === 'http_error'
}

function backoffMs(retryAfterSeconds: number | undefined, intervalMs: number) {
  return retryAfterSeconds === undefined
    ? intervalMs
    : Math.max(retryAfterSeconds * 1000, intervalMs)
}

function timedOut(auditId: string): ApiError {
  return {
    code: 'wait_timeout',
    message: `Timed out waiting for audit ${auditId} to finish.`,
    hint: `The audit may still be running — raise --timeout, or check later with \`xcelera audit get --audit-id ${auditId}\`.`
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
