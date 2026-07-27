import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'

import { runPageCreateCommand } from './page-create.js'

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

test('sends the grouped body and prints the new ref', async () => {
  let body: unknown
  server.use(
    http.post('https://xcelera.dev/api/v1/pages', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({
        success: true,
        data: {
          ref: 'example-com',
          id: 'page-1',
          url: 'https://example.com',
          created: true
        }
      })
    })
  )

  const result = await runPageCreateCommand('test-token', {
    url: 'https://example.com',
    name: 'Home',
    config: { device: 'desktop', region: 'us-central1' }
  })

  expect(result.exitCode).toBe(0)
  expect(body).toEqual({
    url: 'https://example.com',
    name: 'Home',
    config: { device: 'desktop', region: 'us-central1' }
  })
  expect(result.output[0]).toBe('✅ Page registered: example-com')
  expect(result.output).toContainEqual(
    expect.stringContaining('xcelera audit run --ref example-com')
  )
})

test('says the page was already tracked when the upsert hits', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/pages', () =>
      HttpResponse.json({
        success: true,
        data: {
          ref: 'example-com',
          id: 'page-1',
          url: 'https://example.com',
          created: false
        }
      })
    )
  )

  const result = await runPageCreateCommand('test-token', {
    url: 'https://example.com'
  })

  expect(result.exitCode).toBe(0)
  expect(result.output[0]).toContain('already tracked: example-com')
})

test('--json prints the payload', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/pages', () =>
      HttpResponse.json({
        success: true,
        data: {
          ref: 'example-com',
          id: 'page-1',
          url: 'https://example.com',
          created: true
        }
      })
    )
  )

  const result = await runPageCreateCommand(
    'test-token',
    { url: 'https://example.com' },
    { json: true }
  )

  expect(JSON.parse(result.output.join('\n'))).toMatchObject({
    ref: 'example-com',
    created: true
  })
})

test('fails with the api error when the url is rejected', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/pages', () =>
      HttpResponse.json(
        {
          success: false,
          error: {
            code: 'invalid_url',
            message: 'Invalid url: only https URLs are allowed.'
          }
        },
        { status: 400 }
      )
    )
  )

  const result = await runPageCreateCommand('test-token', {
    url: 'http://example.com'
  })

  expect(result.exitCode).toBe(1)
  expect(result.errors).toEqual([
    '❌ Unable to register page :(',
    ' ↳ [invalid_url] Invalid url: only https URLs are allowed.'
  ])
})
