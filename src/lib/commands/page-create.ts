import pc from 'picocolors'

import type { CommandResult, CreatePageBody } from '../../types/index.js'
import { createPage } from '../api.js'
import { formatApiError } from '../audit-report.js'
import { glyph } from '../style.js'

export async function runPageCreateCommand(
  token: string,
  body: CreatePageBody,
  { json = false }: { json?: boolean } = {}
): Promise<CommandResult> {
  const response = await createPage(token, body)

  if (!response.success) {
    return {
      exitCode: 1,
      output: [],
      errors: [
        `${pc.red(glyph.failure)} Unable to register page :(`,
        ...formatApiError(response.error)
      ]
    }
  }

  const page = response.data

  if (json) {
    return { exitCode: 0, output: [JSON.stringify(page, null, 2)], errors: [] }
  }

  return {
    exitCode: 0,
    output: [
      page.created
        ? `${pc.green(glyph.success)} Page registered: ${page.ref}`
        : `${pc.blue(glyph.info)} Page already tracked: ${page.ref}`,
      `   ${page.url}`,
      '',
      `Audit it with \`xcelera audit run --ref ${page.ref} --wait\`.`
    ],
    errors: []
  }
}
