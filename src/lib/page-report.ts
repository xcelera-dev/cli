import pc from 'picocolors'
import stringWidth from 'string-width'

import type { PageSummary } from '../types/index.js'
import { ratingIcon } from './rating.js'
import { glyph } from './style.js'

const COLUMNS = ['REF', 'NAME', 'PERF', 'LCP', 'TBT', 'CLS', 'URL'] as const

const CSV_COLUMNS = [
  'ref',
  'name',
  'performance',
  'lcp',
  'tbt',
  'cls',
  'url'
] as const

/** The tracked pages as a table: identity first, then the latest scores. */
export function formatPageList(pages: PageSummary[]): string[] {
  if (pages.length === 0) {
    return [
      'No pages are being tracked yet.',
      'Register one with `xcelera page create --url https://example.com`.'
    ]
  }

  const rows = pages.map(toRow)
  const widths = COLUMNS.map((column, index) =>
    Math.max(column.length, ...rows.map((row) => stringWidth(row[index])))
  )

  return [
    pc.bold(
      `${glyph.heading} ${pages.length} page${pages.length === 1 ? '' : 's'}`
    ),
    '',
    formatRow([...COLUMNS], widths),
    ...rows.map((row) => formatRow(row, widths))
  ]
}

/** The same pages as CSV: raw values, no icons, header row even when empty. */
export function formatPageListCsv(pages: PageSummary[]): string[] {
  return [
    CSV_COLUMNS.join(','),
    ...pages.map((page) => toCsvRow(page).map(csvCell).join(','))
  ]
}

function toRow(page: PageSummary): string[] {
  const { performance, lcp, tbt, cls } = page.scores ?? {}

  return [
    page.ref,
    page.name ?? '—',
    formatScore(performance),
    formatScore(lcp),
    formatScore(tbt),
    formatScore(cls),
    page.url
  ]
}

function formatScore(metric?: { display: string | number; rating: string }) {
  if (!metric) return '—'
  return `${ratingIcon(metric.rating)} ${metric.display}`
}

// The last column is not padded, so a long url never trails whitespace.
function formatRow(cells: string[], widths: number[]): string {
  return cells
    .map((cell, index) =>
      index === cells.length - 1 ? cell : padCell(cell, widths[index])
    )
    .join('  ')
    .trimEnd()
}

// cell.padEnd would count colour codes and wide/CJK glyphs as one column
// each, so pad by the rendered width instead. page.name comes from the API,
// so it can contain any of those.
function padCell(cell: string, width: number): string {
  return cell + ' '.repeat(Math.max(0, width - stringWidth(cell)))
}

function toCsvRow(page: PageSummary): string[] {
  const { performance, lcp, tbt, cls } = page.scores ?? {}

  return [
    page.ref,
    page.name ?? '',
    csvScore(performance),
    csvScore(lcp),
    csvScore(tbt),
    csvScore(cls),
    page.url
  ]
}

function csvScore(metric?: { display: string | number }): string {
  return metric === undefined ? '' : String(metric.display)
}

function csvCell(value: string): string {
  return /["\n,]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}
