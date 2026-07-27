import type { CommandResult } from '../../types/index.js'
import { listPages } from '../api.js'
import { formatApiError } from '../audit-report.js'
import { formatPageList, formatPageListCsv } from '../page-report.js'

/** Lists the tracked pages — the only way to discover refs outside the app. */
export async function runPageListCommand(
  token: string,
  { json = false, csv = false }: { json?: boolean; csv?: boolean } = {}
): Promise<CommandResult> {
  const response = await listPages(token)

  if (!response.success) {
    return {
      exitCode: 1,
      output: [],
      errors: ['❌ Unable to list pages :(', ...formatApiError(response.error)]
    }
  }

  if (json) {
    return {
      exitCode: 0,
      output: [JSON.stringify(response.data, null, 2)],
      errors: []
    }
  }

  if (csv) {
    return {
      exitCode: 0,
      output: formatPageListCsv(response.data.pages),
      errors: []
    }
  }

  return {
    exitCode: 0,
    output: formatPageList(response.data.pages),
    errors: []
  }
}
