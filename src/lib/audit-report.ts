import {
  ApiError,
  ApiMetric,
  AuditPayload,
  CommandResult
} from '../types/index.js'
import { ratingIcon } from './rating.js'

const TOP_INSIGHTS = 5

/**
 * One audit, however we arrived at it: `audit run --wait` and `audit get`
 * report it identically, and a failed audit is a non-zero exit in both.
 */
export function reportAudit(audit: AuditPayload, json: boolean): CommandResult {
  if (json) {
    return {
      exitCode: audit.status === 'Failed' ? 1 : 0,
      output: [JSON.stringify(audit, null, 2)],
      errors: []
    }
  }

  if (audit.status === 'Failed') {
    return {
      exitCode: 1,
      output: [],
      errors: [
        '❌ Audit failed.',
        ` ↳ [audit_failed] Audit ${audit.auditId} did not produce a result.`,
        ' ↳ Check the audit on your dashboard, or run it again.'
      ]
    }
  }

  if (audit.status !== 'Succeeded') {
    return {
      exitCode: 0,
      output: [
        `⏳ Audit ${audit.auditId} is ${audit.status.toLowerCase()} — no results yet.`,
        '   Use --wait to block until it finishes.'
      ],
      errors: []
    }
  }

  return { exitCode: 0, output: formatAudit(audit), errors: [] }
}

/** An audit as the human output renders it: scores, then the biggest wins. */
export function formatAudit(audit: AuditPayload): string[] {
  const lines: string[] = []

  lines.push(`📊 ${audit.name ?? audit.ref} — ${audit.url}`)
  if (audit.git.hash) {
    const branch = audit.git.branch ? ` (${audit.git.branch})` : ''
    lines.push(`   commit ${audit.git.hash}${branch}`)
  }
  lines.push('')

  lines.push(...formatCategories(audit))
  lines.push(...formatCoreWebVitals(audit))
  lines.push(...formatCaveats(audit))
  lines.push(...formatInsights(audit))

  if (audit.reportUrl) {
    lines.push('')
    lines.push(`📄 Report (expires in 1 hour): ${audit.reportUrl}`)
  }

  return lines
}

/** Prints every part of a failure — `code` is what CI scripts match on. */
export function formatApiError(error: ApiError): string[] {
  const lines = [` ↳ [${error.code}] ${error.message}`]
  if (error.hint) {
    lines.push(` ↳ ${error.hint}`)
  }
  if (error.details) {
    lines.push(` ↳ ${error.details}`)
  }
  return lines
}

function formatCategories(audit: AuditPayload): string[] {
  const { performance, accessibility, bestPractices, seo } =
    audit.metrics.categories
  const entries: [string, ApiMetric | undefined][] = [
    ['Performance', performance],
    ['Accessibility', accessibility],
    ['Best practices', bestPractices],
    ['SEO', seo]
  ]

  return formatMetricSection('Scores:', entries)
}

function formatCoreWebVitals(audit: AuditPayload): string[] {
  const { lcp, tbt, cls, fcp, si } = audit.metrics.audits
  const entries: [string, ApiMetric | undefined][] = [
    ['LCP', lcp],
    ['TBT', tbt],
    ['CLS', cls],
    ['FCP', fcp],
    ['Speed Index', si]
  ]

  return formatMetricSection('Metrics:', entries)
}

function formatMetricSection(
  heading: string,
  entries: [string, ApiMetric | undefined][]
): string[] {
  const present = entries.filter(([, metric]) => metric !== undefined)
  if (present.length === 0) return []

  return [
    heading,
    ...present.map(([label, metric]) => formatMetricLine(label, metric)),
    ''
  ]
}

function formatMetricLine(label: string, metric?: ApiMetric): string {
  if (!metric) return `   ${label.padEnd(14)} —`
  const icon = ratingIcon(metric.rating)
  return `   ${icon} ${label.padEnd(14)} ${metric.display}`
}

/**
 * Reasons to distrust the number before acting on it: windowed and imputed
 * scores are lower bounds, not measurements.
 */
function formatCaveats(audit: AuditPayload): string[] {
  const lines: string[] = []

  if (audit.windowed) {
    lines.push(
      '   ⚠️  A run hit the observation window before the page settled; the score is a partial-load measurement.'
    )
  }
  if (audit.scoreImputed) {
    lines.push(
      '   ⚠️  Blocking time could not be measured on every run; the performance score is a lower bound.'
    )
  }

  return lines.length > 0 ? [...lines, ''] : []
}

function formatInsights(audit: AuditPayload): string[] {
  const insights = audit.insights.slice(0, TOP_INSIGHTS)
  if (insights.length === 0) return []

  return [
    `Top opportunities (${insights.length} of ${audit.insights.length}):`,
    ...insights.map((insight) => {
      const savings = formatSavings(insight.metricSavings)
      return `   • ${insight.title}${savings}`
    })
  ]
}

function formatSavings(savings?: Record<string, number | undefined>): string {
  if (!savings) return ''
  const parts = Object.entries(savings)
    .filter(([, value]) => typeof value === 'number' && value > 0)
    .map(([metric, value]) =>
      metric === 'CLS' ? `${metric} ${value}` : `${metric} ${value}ms`
    )
  return parts.length > 0 ? ` — saves ${parts.join(', ')}` : ''
}
