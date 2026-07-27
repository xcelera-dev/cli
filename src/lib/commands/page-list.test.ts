import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'

import { trackedPage } from '../test-utils.js'
import { runPageListCommand } from './page-list.js'

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

test('prints a row per page with its latest scores', async () => {
  server.use(
    http.get('https://xcelera.dev/api/v1/pages', () =>
      HttpResponse.json({
        success: true,
        data: {
          pages: [
            trackedPage(),
            trackedPage({
              ref: 'never-audited',
              name: undefined,
              url: 'https://example.com/new',
              scores: undefined
            })
          ]
        }
      })
    )
  )

  const result = await runPageListCommand('test-token')

  expect(result.exitCode).toBe(0)
  expect(result.output[0]).toBe('📄 2 pages')
  expect(result.output).toContainEqual(expect.stringContaining('REF'))
  expect(result.output[3]).toMatch(
    /^example-com\s+Example\s+🟠 82\s+🟠 2\.4s\s+🟢 120ms\s+🟢 0\.02\s+https:\/\/example\.com$/
  )
  // A page with no audit yet still gets a row, with dashes for its scores.
  expect(result.output[4]).toMatch(
    /^never-audited\s+—\s+—\s+—\s+—\s+—\s+https:\/\/example\.com\/new$/
  )
})

test('says so when nothing is tracked yet', async () => {
  server.use(
    http.get('https://xcelera.dev/api/v1/pages', () =>
      HttpResponse.json({ success: true, data: { pages: [] } })
    )
  )

  const result = await runPageListCommand('test-token')

  expect(result.exitCode).toBe(0)
  expect(result.output[0]).toContain('No pages are being tracked')
})

test('--json prints the payload', async () => {
  server.use(
    http.get('https://xcelera.dev/api/v1/pages', () =>
      HttpResponse.json({ success: true, data: { pages: [trackedPage()] } })
    )
  )

  const result = await runPageListCommand('test-token', { json: true })

  expect(result.exitCode).toBe(0)
  expect(JSON.parse(result.output.join('\n'))).toMatchObject({
    pages: [{ ref: 'example-com' }]
  })
})

test('--csv prints a header and the raw values', async () => {
  server.use(
    http.get('https://xcelera.dev/api/v1/pages', () =>
      HttpResponse.json({
        success: true,
        data: {
          pages: [
            trackedPage({ name: 'Home, and "away"' }),
            trackedPage({
              ref: 'never-audited',
              name: undefined,
              url: 'https://example.com/new',
              scores: undefined
            })
          ]
        }
      })
    )
  )

  const result = await runPageListCommand('test-token', { csv: true })

  expect(result.exitCode).toBe(0)
  expect(result.output).toEqual([
    'ref,name,performance,lcp,tbt,cls,url',
    'example-com,"Home, and ""away""",82,2.4s,120ms,0.02,https://example.com',
    'never-audited,,,,,,https://example.com/new'
  ])
})

test('--csv prints the header alone when nothing is tracked', async () => {
  server.use(
    http.get('https://xcelera.dev/api/v1/pages', () =>
      HttpResponse.json({ success: true, data: { pages: [] } })
    )
  )

  const result = await runPageListCommand('test-token', { csv: true })

  expect(result.exitCode).toBe(0)
  expect(result.output).toEqual(['ref,name,performance,lcp,tbt,cls,url'])
})

test('prints code, message and hint on failure', async () => {
  server.use(
    http.get('https://xcelera.dev/api/v1/pages', () =>
      HttpResponse.json(
        {
          success: false,
          error: {
            code: 'invalid_token',
            message: 'Invalid API token.',
            hint: 'Create a new token in Settings.'
          }
        },
        { status: 401 }
      )
    )
  )

  const result = await runPageListCommand('test-token')

  expect(result.exitCode).toBe(1)
  expect(result.errors).toEqual([
    '❌ Unable to list pages :(',
    ' ↳ [invalid_token] Invalid API token.',
    ' ↳ Create a new token in Settings.'
  ])
})
