import pc from 'picocolors'

import type { AuditSelector, CommandResult } from '../../types/index.js'
import { getAudit } from '../api.js'
import { formatApiError, reportAudit } from '../audit-report.js'
import { glyph } from '../style.js'

export type AuditGetOptions = {
  selector: AuditSelector
  json?: boolean
}

/** Fetches an existing audit without starting anything. */
export async function runAuditGetCommand(
  token: string,
  { selector, json = false }: AuditGetOptions
): Promise<CommandResult> {
  const response = await getAudit(token, selector)

  if (!response.success) {
    return {
      exitCode: 1,
      output: [],
      errors: [
        `${pc.red(glyph.failure)} Unable to fetch audit :(`,
        ...formatApiError(response.error)
      ]
    }
  }

  return {
    ...reportAudit(response.data, json),
    auditId: response.data.auditId
  }
}
