export type SuccessResponse<T> = {
  success: true
  data: T
}

export type ErrorResponse<E> = {
  success: false
  error: E
}

export type ApiResponse<T, E> = SuccessResponse<T> | ErrorResponse<E>

export interface CommandResult {
  exitCode: number
  output: string[]
  errors: string[]
}

export type BuildContext = {
  service: string
  prNumber?: string
  buildNumber?: string
  buildUrl?: string
  git?: GitContext
}
export interface GitContext {
  owner: string
  repo: string
  branch?: string
  commit: CommitInfo
}

export type CommitInfo = {
  hash: string
  message: string
  author: string
  date: string
}

export type GithubIntegrationContext =
  | {
      status: 'success'
      installationId: number
      checkRunId: number
    }
  | {
      status: 'skipped'
      reason: 'no_git_context' | 'no_installation'
    }
  | {
      status: 'misconfigured'
      reason: 'no_repo_access'
      installationId: number
    }
  | {
      status: 'error'
    }
