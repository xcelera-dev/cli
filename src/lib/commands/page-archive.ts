import pc from 'picocolors'

import type { CommandResult } from '../../types/index.js'
import { archivePage } from '../api.js'
import { formatApiError } from '../audit-report.js'
import { glyph } from '../style.js'

export async function runPageArchiveCommand(
  token: string,
  ref: string,
  { json = false }: { json?: boolean } = {}
): Promise<CommandResult> {
  const response = await archivePage(token, ref)

  if (!response.success) {
    return {
      exitCode: 1,
      output: [],
      errors: [
        `${pc.red(glyph.failure)} Unable to archive page :(`,
        ...formatApiError(response.error)
      ]
    }
  }

  if (json) {
    return {
      exitCode: 0,
      output: [JSON.stringify(response.data, null, 2)],
      errors: []
    }
  }

  return {
    exitCode: 0,
    output: [
      `${pc.green(glyph.success)} Page archived: ${ref}`,
      `   Its audit history is kept under ref ${ref}.`
    ],
    errors: []
  }
}
