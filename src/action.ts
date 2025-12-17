/* istanbul ignore file */
import * as core from '@actions/core'

import { type AuthOptions, runAuditCommand } from './lib/commands/audit.js'

run()

async function run(): Promise<void> {
  const url = core.getInput('url', { required: true })
  const token = core.getInput('token', { required: true })

  const authOptions = parseAuthInputs()

  const result = await runAuditCommand(url, token, authOptions)

  result.output.forEach((line: string) => core.info(line))
  result.errors.forEach((line: string) => core.error(line))

  if (result.exitCode !== 0) {
    core.setFailed('Audit command failed')
    core.setOutput('status', 'failed')
  } else {
    core.setOutput('status', 'success')
  }
}

function parseAuthInputs(): AuthOptions | undefined {
  const auth = core.getInput('auth')
  const cookie = core.getInput('cookie')
  const header = core.getInput('header')

  if (!auth && !cookie && !header) {
    return undefined
  }

  return {
    authJson: auth || undefined,
    cookies: cookie ? [cookie] : undefined,
    headers: header ? [header] : undefined
  }
}
