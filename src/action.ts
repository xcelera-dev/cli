/* istanbul ignore file */
import * as core from '@actions/core'

import { runAuditCommand } from './lib/commands/audit.js'

run()

async function run(): Promise<void> {
  const url = core.getInput('url', { required: true })
  const token = core.getInput('token', { required: true })

  const result = await runAuditCommand(url, token)

  result.output.forEach((line: string) => core.info(line))
  result.errors.forEach((line: string) => core.error(line))

  if (result.exitCode !== 0) {
    core.setFailed('Audit command failed')
    core.setOutput('status', 'failed')
  } else {
    core.setOutput('status', 'success')
  }
}
