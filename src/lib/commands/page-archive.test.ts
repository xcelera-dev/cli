import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'

import { runPageArchiveCommand } from './page-archive.js'

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

test('archives the page and keeps its ref for later', async () => {
  let method: string | undefined
  server.use(
    http.delete(
      'https://xcelera.dev/api/v1/pages/example-com',
      ({ request }) => {
        method = request.method
        return HttpResponse.json({
          success: true,
          data: { ref: 'example-com', archived: true }
        })
      }
    )
  )

  const result = await runPageArchiveCommand('test-token', 'example-com')

  expect(method).toBe('DELETE')
  expect(result.exitCode).toBe(0)
  expect(result.output[0]).toContain('Page archived: example-com')
  expect(result.output[1]).toContain('history is kept')
})

test('fails with the api error when the ref is unknown', async () => {
  server.use(
    http.delete('https://xcelera.dev/api/v1/pages/nope', () =>
      HttpResponse.json(
        {
          success: false,
          error: {
            code: 'page_not_found',
            message: 'No page found for ref "nope".',
            hint: 'Call list_pages (MCP) or GET /api/v1/pages to see valid refs.'
          }
        },
        { status: 404 }
      )
    )
  )

  const result = await runPageArchiveCommand('test-token', 'nope')

  expect(result.exitCode).toBe(1)
  expect(result.errors[0]).toBe('❌ Unable to archive page :(')
  expect(result.errors[1]).toContain('[page_not_found]')
})
