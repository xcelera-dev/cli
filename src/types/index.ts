export type SuccessResponse<T> = {
  success: true
  data: T
}

export type ErrorResponse<E> = {
  success: false
  error: E
}

export type ApiResponse<T, E> = SuccessResponse<T> | ErrorResponse<E>

export type BuildContext = {
  service: string
  prNumber?: string
  build?: string
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
  email: string
  date: string
}
