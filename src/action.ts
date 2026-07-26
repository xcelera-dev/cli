/* istanbul ignore file */
import * as core from '@actions/core'

import {
  DEFAULT_WAIT_TIMEOUT_SECONDS,
  type RunAuditOptions,
  runAuditCommand
} from './lib/commands/audit.js'

run()

async function run(): Promise<void> {
  const ref = core.getInput('ref', { required: true })
  const token = core.getInput('token', { required: true })

  const timeout = parseTimeout()
  if ('error' in timeout) {
    core.setFailed(timeout.error)
    core.setOutput('status', 'failed')
    return
  }

  const result = await runAuditCommand(ref, token, {
    ...parseAuthInputs(),
    wait: core.getBooleanInput('wait'),
    timeoutSeconds: timeout.seconds
  })

  result.output.forEach((line: string) => core.info(line))
  result.errors.forEach((line: string) => core.error(line))

  if (result.auditId) {
    core.setOutput('auditId', result.auditId)
  }

  if (result.exitCode !== 0) {
    core.setFailed('Audit command failed')
    core.setOutput('status', 'failed')
  } else {
    core.setOutput('status', 'success')
  }
}

function parseAuthInputs(): RunAuditOptions {
  const cookieFile = core.getInput('cookie-file')
  const cookie = core.getInput('cookie')
  const header = core.getInput('header')

  return {
    cookieFile: cookieFile || undefined,
    cookies: cookie ? [cookie] : undefined,
    headers: header ? [header] : undefined
  }
}

function parseTimeout(): { seconds: number } | { error: string } {
  const raw = core.getInput('timeout')
  if (!raw) return { seconds: DEFAULT_WAIT_TIMEOUT_SECONDS }

  const seconds = Number(raw)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return {
      error: `timeout must be a positive number of seconds, got "${raw}"`
    }
  }
  return { seconds }
}
