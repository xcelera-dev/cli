import * as core from '@actions/core'
import * as github from '@actions/github'

import { requestAudit } from './api.js'

run()

async function run(): Promise<void> {
  try {
    const url = core.getInput('url', { required: true })
    const token = core.getInput('token', { required: true })

    const githubContext = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      sha: github.context.sha
    }

    core.debug(`Calling xcelera audit API with URL: ${url}`)
    const response = await requestAudit(url, token, githubContext)

    if (!response.success) {
      const { message, details } = response.error

      core.setFailed('❌ Unable to schedule audit :(')
      core.error(message)
      if (details) {
        core.error(` ↳ ${details}`)
      }
      core.setOutput('status', 'failed')
      return
    }

    const { auditId, status, integrations } = response.data
    core.info('✅ Audit scheduled successfully!')
    core.debug(`Audit ID: ${auditId}`)
    core.debug(`Status: ${status}`)
    if (integrations && integrations.github) {
      core.info('GitHub integration detected')
      const { installationId, hasRepoAccess } = integrations.github
      if (installationId && !hasRepoAccess) {
        core.warning(
          'The xcelera.dev Github app is installed, but it does not have repository access.'
        )
      }
      core.debug(` ↳ installation ID: ${integrations.github.installationId}`)
      core.debug(` ↳ check run ID: ${integrations.github.checkRunId}`)
      core.debug(
        ` ↳ installation has repo access: ${integrations.github.hasRepoAccess}`
      )
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    core.error(`❌ ${errorMessage}`)
    core.setFailed(errorMessage)
    core.setOutput('status', 'failed')
  }
}
