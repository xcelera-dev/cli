import * as core from '@actions/core'

interface AuditResponse {
  auditId: string
  status: string
}

export async function run(): Promise<void> {
  try {
    const url = core.getInput('url', { required: true })
    const token = core.getInput('token', { required: true })

    core.debug(`Auditing URL: ${url}`)
    core.debug(`API Base URL: ${getApiBaseUrl()}`)

    core.debug('Calling Xcelera audit API...')
    const response = await requestAudit(url, token)

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

async function requestAudit(
  url: string,
  token: string
): Promise<AuditResponse> {
  const apiUrl = `${getApiBaseUrl()}/api/v1/audit`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ url })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `API request failed: ${response.status} ${response.statusText} - ${errorText}`
    )
  }

  const data = await response.json()
  return data as AuditResponse
}

function getApiBaseUrl(): string {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.GITHUB_ACTIONS !== 'true'
  ) {
    return 'http://localhost:3000'
  }
  return 'https://xcelera.dev'
}
