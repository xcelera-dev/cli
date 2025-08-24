import isNetworkError from 'is-network-error'

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

  try {
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
  } catch (error) {
    if (isNetworkError(error)) {
      throw new Error('Network error', { cause: error })
    }
    throw error
  }
}

function getApiBaseUrl(): string {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000'
  }
  return 'https://xcelera.dev'
}
