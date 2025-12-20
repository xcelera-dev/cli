import { readFileSync } from 'node:fs'

import type { Cookie } from '../../types/index.js'

export type NetscapeCookieParseResult = {
  cookies: Cookie[]
  warnings: string[]
}

export function readNetscapeCookieFileSync(
  filePath: string,
  now: Date = new Date()
): NetscapeCookieParseResult {
  try {
    const contents = readFileSync(filePath, 'utf8')
    return parseNetscapeCookieFileContents(contents, filePath, now)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to read cookie file "${filePath}": ${message}`)
  }
}

export function parseNetscapeCookieFileContents(
  contents: string,
  sourceLabel = 'cookie file',
  now: Date = new Date()
): NetscapeCookieParseResult {
  const cookies: Cookie[] = []
  const expiredCookieNames: string[] = []

  const nowEpochSeconds = Math.floor(now.getTime() / 1000)

  const lines = contents.split(/\r?\n/)
  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index]
    const line = rawLine.trim()

    if (!line) {
      continue
    }

    if (line.startsWith('#') && !line.startsWith('#HttpOnly_')) {
      continue
    }

    const fields = line.split('\t')
    if (fields.length !== 7) {
      throw new Error(
        `Invalid Netscape cookie line ${
          index + 1
        } in ${sourceLabel}: expected 7 tab-separated fields`
      )
    }

    let domain = fields[0]
    const path = fields[2] || undefined
    const secure = toBool(fields[3])
    const expiresEpochSeconds = parseEpochSeconds(
      fields[4],
      index + 1,
      sourceLabel
    )
    const name = fields[5]
    const value = fields[6] ?? ''

    let httpOnly: boolean | undefined
    if (domain.startsWith('#HttpOnly_')) {
      httpOnly = true
      domain = domain.slice('#HttpOnly_'.length)
    }

    const isExpired =
      expiresEpochSeconds > 0 && expiresEpochSeconds < nowEpochSeconds

    if (isExpired) {
      expiredCookieNames.push(name)
      continue
    }

    const cookie: Cookie = {
      name,
      value,
      ...(domain && { domain }),
      ...(path && { path }),
      ...(secure && { secure: true }),
      ...(httpOnly && { httpOnly: true })
    }

    cookies.push(cookie)
  }

  const warnings: string[] = []
  if (expiredCookieNames.length > 0) {
    const preview = expiredCookieNames.slice(0, 5).join(', ')
    const suffix = expiredCookieNames.length > 5 ? ', …' : ''
    warnings.push(
      `⚠️ Dropped ${expiredCookieNames.length} expired cookie(s) from ${sourceLabel}: ${preview}${suffix}`
    )
  }

  return { cookies, warnings }
}

function toBool(value: string): boolean {
  return value.trim().toUpperCase() === 'TRUE'
}

function parseEpochSeconds(
  value: string,
  lineNumber: number,
  sourceLabel: string
): number {
  const trimmed = value.trim()
  const num = Number.parseInt(trimmed, 10)
  if (Number.isNaN(num)) {
    throw new Error(
      `Invalid expiration epoch seconds at line ${lineNumber} in ${sourceLabel}`
    )
  }
  return num
}
