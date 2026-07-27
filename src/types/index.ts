export type SuccessResponse<T> = {
  success: true
  data: T
}

export interface Cookie {
  name: string
  value: string
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export interface AuthCredentials {
  cookies?: Cookie[]
  headers?: Record<string, string>
}

export type ErrorResponse<E> = {
  success: false
  error: E
}

export type ApiResponse<T, E> = SuccessResponse<T> | ErrorResponse<E>

/**
 * Every /api/v1 failure. `code` is the stable string to match on in scripts;
 * `message` and `hint` are for humans. Never match on `message`.
 */
export type ApiError = {
  code: string
  message: string
  hint?: string
  details?: string
}

export type Rating = 'good' | 'needs-improvement' | 'poor'

/** `raw` is canonical units: 0-100 scores, ms for time metrics, unitless CLS. */
export type ApiMetric = {
  raw: number
  display: string | number
  rating: Rating
}

export type AuditStatus = 'Scheduled' | 'Running' | 'Succeeded' | 'Failed'

export type AuditMetrics = {
  categories: {
    performance?: ApiMetric
    accessibility?: ApiMetric
    bestPractices?: ApiMetric
    seo?: ApiMetric
  }
  audits: {
    lcp?: ApiMetric
    tbt?: ApiMetric
    cls?: ApiMetric
    fcp?: ApiMetric
    si?: ApiMetric
  }
}

export type AuditInsight = {
  id: string
  title: string
  description?: string
  displayValue?: string
  score: number
  metricSavings?: {
    FCP?: number
    LCP?: number
    TBT?: number
    CLS?: number
  }
}

export type AuditGitContext = {
  hash?: string
  branch?: string
  prNumber?: number
  commitMessage?: string
  author?: string
}

/**
 * GET /api/v1/audits response. See
 * the api docs, which are the contract of record.
 */
export type AuditPayload = {
  auditId: string
  ref: string
  name?: string
  url: string
  status: AuditStatus
  runAt: string | null
  source: string
  git: AuditGitContext
  metrics: AuditMetrics
  insights: AuditInsight[]
  windowed: boolean
  scoreImputed: boolean
  reportUrl?: string
}

export type PageSummaryMetrics = {
  performance?: ApiMetric
  lcp?: ApiMetric
  tbt?: ApiMetric
  cls?: ApiMetric
}

/** One tracked page as GET /api/v1/pages returns it. */
export type PageSummary = {
  ref: string
  name?: string
  url: string
  auditStatus?: string
  lastAuditAt?: string
  auditId?: string
  scores?: PageSummaryMetrics
  warning?: string
  warningMessages?: string[]
}

export type ListPagesPayload = {
  pages: PageSummary[]
}

/** POST /api/v1/pages body. `config` groups how the page is audited. */
export type CreatePageBody = {
  url: string
  name?: string
  config?: {
    device?: 'mobile' | 'desktop'
    region?: string
  }
}

export type CreatePagePayload = {
  ref: string
  id: string
  url: string
  /** False when the url + device was already tracked and that page came back. */
  created: boolean
}

export type ArchivePagePayload = {
  ref: string
  archived: true
}

/** Selects exactly one audit. auditId wins; otherwise ref plus one qualifier. */
export type AuditSelector = {
  auditId?: string
  ref?: string
  gitHash?: string
  prNumber?: string
}

export interface CommandResult {
  exitCode: number
  output: string[]
  errors: string[]
  /** Set once a command has resolved an audit; the GitHub Action outputs it. */
  auditId?: string
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
