import type { GitContext } from './types/git.js'

export interface AuditResponse {
  auditId: string
  status: string
}

export async function requestAudit(
  url: string,
  token: string,
  github: GitContext
): Promise<AuditResponse> {
  const apiUrl = `${getApiBaseUrl()}/api/v1/audit`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      url,
      github
    })
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
