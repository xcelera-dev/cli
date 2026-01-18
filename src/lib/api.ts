import isNetworkError from 'is-network-error'

import {
  ApiResponse,
  AuthCredentials,
  BuildContext,
  ErrorResponse,
  GithubIntegrationContext,
  SuccessResponse
} from '../types/index.js'

type AuditData = {
  auditId: string
  status: string
  integrations: {
    github?: GithubIntegrationContext
  }
}

type AuditError = {
  message: string
  details: string
}

type AuditResponse = ApiResponse<AuditData, AuditError>

export async function requestAudit(
  ref: string,
  token: string,
  context: BuildContext,
  auth?: AuthCredentials
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
        ref,
        context,
        ...(auth && { auth })
      })
    })
    if (!response.ok) {
      // handle expected errors
      if (response.headers.get('content-type')?.includes('application/json')) {
        const errorResponse =
          (await response.json()) as ErrorResponse<AuditError>
        return errorResponse
      }
      // handle unexpected errors
      const errorText = await response.text()
      throw new Error(
        `Operation failed: ${response.status} ${response.statusText} - ${errorText}`
      )
    }

    const { data } = (await response.json()) as SuccessResponse<AuditData>
    return {
      success: true,
      data
    }
  } catch (error) {
    if (isNetworkError(error)) {
      return {
        success: false,
        error: {
          message: 'Network error',
          details: error.message
        }
      }
    }
    throw error
  }
}

/* istanbul ignore next */
function getApiBaseUrl(): string {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000'
  }
  return 'https://xcelera.dev'
}
