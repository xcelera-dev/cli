import type {
  AuthCredentials,
  BuildContext,
  CommandResult,
  Cookie,
  GithubIntegrationContext
} from '../../types/index.js'
import { requestAudit } from '../api.js'
import { waitForAudit } from '../audit-poll.js'
import { formatApiError, reportAudit } from '../audit-report.js'
import { inferBuildContext } from '../buildContext.js'
import { readNetscapeCookieFileSync } from '../cookies/netscape.js'
import { type Progress, silentProgress } from '../progress.js'

export interface AuthOptions {
  cookieFile?: string
  cookies?: string[]
  headers?: string[]
}

export interface RunAuditOptions extends AuthOptions {
  /** Block until the audit reaches a terminal status and report the result. */
  wait?: boolean
  timeoutSeconds?: number
  json?: boolean
  /** Where to stream output as it happens. Defaults to buffering silently. */
  progress?: Progress
  /** Test seam — the poll cadence and clock. */
  pollIntervalMs?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

export const DEFAULT_WAIT_TIMEOUT_SECONDS = 600

export async function runAuditCommand(
  ref: string,
  token: string,
  options?: RunAuditOptions
): Promise<CommandResult> {
  const output: string[] = []
  const errors: string[] = []
  const json = options?.json ?? false
  const progress = options?.progress ?? silentProgress

  // Buffer and stream together, so every line in `output` has already been
  // printed by the time the command returns.
  function emit(...lines: string[]): void {
    for (const line of lines) {
      output.push(line)
      progress.line(line)
    }
  }

  try {
    const buildContext = await inferBuildContext()
    if (!json) {
      emit(...formatBuildContext(buildContext))
    }

    const { auth, warnings } = parseAuthCredentials(options)
    errors.push(...warnings)
    if (auth && !json) {
      emit('🔐 Authentication credentials detected', '')
    }

    const response = await requestAudit(ref, token, buildContext, auth)

    if (!response.success) {
      errors.push('❌ Unable to schedule audit :(')
      errors.push(...formatApiError(response.error))
      return { exitCode: 1, output, errors }
    }

    const { auditId, status, integrations } = response.data

    if (!json) {
      emit('✅ Audit scheduled successfully!')

      if (process.env.DEBUG) {
        emit('', `Audit ID: ${auditId}`, `Status: ${status}`)

        if (!integrations || Object.keys(integrations).length === 0) {
          emit('No integrations detected')
        }
      }

      if (integrations?.github) {
        const githubOutput = formatGitHubIntegrationStatus(integrations.github)
        emit(...githubOutput.output)
        errors.push(...githubOutput.errors)
      }
    }

    if (!options?.wait) {
      if (json) {
        emit(JSON.stringify(response.data, null, 2))
      }
      return { exitCode: 0, output, errors, auditId }
    }

    const waited = await waitForAudit(auditId, token, {
      timeoutSeconds: options.timeoutSeconds ?? DEFAULT_WAIT_TIMEOUT_SECONDS,
      intervalMs: options.pollIntervalMs,
      sleep: options.sleep,
      now: options.now,
      onTick: (tick) =>
        progress.status(
          `⏳ ${tick.status} — ${formatElapsed(tick.elapsedMs)} elapsed`
        )
    })
    progress.finish()

    if (!waited.done) {
      errors.push('❌ Audit did not complete.')
      errors.push(...formatApiError(waited.error))
      return { exitCode: 1, output, errors, auditId }
    }

    const finished = reportAudit(waited.audit, json)
    if (!json) emit('')
    emit(...finished.output)
    errors.push(...finished.errors)
    return { exitCode: finished.exitCode, output, errors, auditId }
  } catch (error) {
    progress.finish()
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    errors.push(`❌ ${errorMessage}`)

    if (error instanceof Error && error.stack) {
      errors.push('')
      errors.push(error.stack)
    }

    return { exitCode: 1, output, errors }
  }
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function formatBuildContext(context: BuildContext): string[] {
  const logs: string[] = []
  logs.push('🔍 Inferred build context:')
  if (context.service) {
    logs.push(`   • service: ${context.service}`)
  }
  if (context.git) {
    logs.push(`   • repository: ${context.git.owner}/${context.git.repo}`)
    logs.push(`   • branch: ${context.git.branch}`)
    logs.push(`   • commit: ${context.git.commit.hash}`)
  }
  logs.push('')
  return logs
}

function formatGitHubIntegrationStatus(context: GithubIntegrationContext): {
  output: string[]
  errors: string[]
} {
  const output: string[] = []
  const errors: string[] = []

  output.push('')

  switch (context.status) {
    case 'success': {
      output.push('✅ GitHub integration detected!')

      if (process.env.DEBUG) {
        output.push(` ↳ installation ID: ${context.installationId}`)
        output.push(` ↳ check run ID: ${context.checkRunId}`)
      }
      break
    }
    case 'skipped': {
      if (process.env.DEBUG) {
        const reasonMessage =
          context.reason === 'no_git_context'
            ? 'no git context detected; skipping GitHub integration.'
            : 'GitHub app not installed; skipping GitHub integration.'
        output.push(`↳ GitHub integration skipped: ${reasonMessage}`)
      }
      break
    }
    case 'misconfigured': {
      errors.push('⚠️ GitHub integration is misconfigured.')
      if (context.reason === 'no_repo_access') {
        errors.push(
          'The xcelera.dev GitHub app is installed, but it does not have access to this repository.'
        )
        errors.push(
          'Please update the GitHub app installation and grant access to this repository.'
        )
      }

      if (process.env.DEBUG) {
        errors.push(` ↳ installation ID: ${context.installationId}`)
      }
      break
    }
    case 'error': {
      errors.push('⚠️ Something went wrong with the GitHub integration.')
      errors.push(
        'Your audit was scheduled successfully, but we could not create or update the GitHub check run.'
      )
      break
    }
  }

  return { output, errors }
}

function parseAuthCredentials(options?: AuthOptions): {
  auth?: AuthCredentials
  warnings: string[]
} {
  const warnings: string[] = []
  const cookies: Cookie[] = []
  if (options?.cookieFile) {
    const parsed = readNetscapeCookieFileSync(options.cookieFile)
    warnings.push(...parsed.warnings)
    cookies.push(...parsed.cookies)
  }

  if (options?.cookies && options.cookies.length > 0) {
    cookies.push(...options.cookies.map(parseCookie))
  }

  const hasHeaders = options?.headers && options.headers.length > 0
  const hasCookies = cookies.length > 0

  if (!hasCookies && !hasHeaders) {
    return { auth: undefined, warnings }
  }

  const auth: AuthCredentials = {}

  if (hasCookies) {
    auth.cookies = cookies
  }

  if (hasHeaders && options?.headers) {
    auth.headers = {}
    for (const header of options.headers) {
      const colonIndex = header.indexOf(':')
      if (colonIndex === -1) {
        throw new Error(
          `Invalid header format: "${header}". Expected "Name: Value"`
        )
      }
      const name = header.slice(0, colonIndex).trim()
      const value = header.slice(colonIndex + 1).trim()
      auth.headers[name] = value
    }
  }

  return { auth, warnings }
}

function parseCookie(cookie: string): Cookie {
  const equalsIndex = cookie.indexOf('=')
  if (equalsIndex === -1) {
    throw new Error(`Invalid cookie format: "${cookie}". Expected "name=value"`)
  }
  return {
    name: cookie.slice(0, equalsIndex),
    value: cookie.slice(equalsIndex + 1)
  }
}
