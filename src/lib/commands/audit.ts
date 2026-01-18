import type {
  AuthCredentials,
  BuildContext,
  CommandResult,
  Cookie,
  GithubIntegrationContext
} from '../../types/index.js'
import { requestAudit } from '../api.js'
import { inferBuildContext } from '../buildContext.js'
import { readNetscapeCookieFileSync } from '../cookies/netscape.js'

export interface AuthOptions {
  cookieFile?: string
  cookies?: string[]
  headers?: string[]
}

export async function runAuditCommand(
  ref: string,
  token: string,
  authOptions?: AuthOptions
): Promise<CommandResult> {
  const output: string[] = []
  const errors: string[] = []

  try {
    const buildContext = await inferBuildContext()
    output.push(...formatBuildContext(buildContext))

    const { auth, warnings } = parseAuthCredentials(authOptions)
    errors.push(...warnings)
    if (auth) {
      output.push('🔐 Authentication credentials detected')
      output.push('')
    }

    const response = await requestAudit(ref, token, buildContext, auth)

    if (!response.success) {
      const { message, details } = response.error
      errors.push('❌ Unable to schedule audit :(')
      errors.push(` ↳ ${message}`)
      if (details) {
        errors.push(` ↳ ${JSON.stringify(details)}`)
      }
      return { exitCode: 1, output, errors }
    }

    const { auditId, status, integrations } = response.data

    output.push('✅ Audit scheduled successfully!')

    if (process.env.DEBUG) {
      output.push('')
      output.push(`Audit ID: ${auditId}`)
      output.push(`Status: ${status}`)

      if (Object.keys(integrations).length === 0) {
        output.push('No integrations detected')
      }
    }

    if (integrations?.github) {
      const githubOutput = formatGitHubIntegrationStatus(integrations.github)
      output.push(...githubOutput.output)
      errors.push(...githubOutput.errors)
    }

    return { exitCode: 0, output, errors }
  } catch (error) {
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
