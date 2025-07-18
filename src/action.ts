import * as core from '@actions/core'
import * as github from '@actions/github'
import { requestAudit } from './api.js'

run()

async function run(): Promise<void> {
  try {
    const url = core.getInput('url', { required: true })
    const token = core.getInput('token', { required: true })

    core.debug(`Auditing URL: ${url}`)

    core.debug('Calling Xcelera audit API...')
    const githubContext = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      sha: github.context.sha
    }
    const response = await requestAudit(url, token, githubContext)

    // Set outputs
    core.setOutput('auditId', response.auditId)
    core.setOutput('status', response.status)

    core.info(`✅ Audit scheduled successfully!`)
    core.info(`Audit ID: ${response.auditId}`)
    core.info(`Status: ${response.status}`)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    core.setFailed(errorMessage)
    core.setOutput('status', 'failed')
  }
}
