import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeEach, expect, test } from 'vitest'
import { getAudit, requestAudit } from './api.js'
import { succeededAudit } from './test-utils.js'

const server = setupServer()
server.listen()
beforeEach(() => {
  server.resetHandlers()
  delete process.env.XCELERA_API_URL
})
afterEach(() => {
  delete process.env.XCELERA_API_URL
})
afterAll(() => server.close())

const context = {
  service: 'github',
  git: {
    owner: 'xcelera',
    repo: 'cli',
    commit: {
      hash: '123',
      message: 'test',
      author: 'test',
      date: '2021-01-01'
    }
  }
}

test('should be able to request an audit', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/audits', () => {
      return HttpResponse.json({
        success: true,
        data: {
          auditId: 'abc-123',
          status: 'scheduled'
        }
      })
    })
  )

  const response = await requestAudit('xcelera-dev', 'fake-token', context)

  expect(response).toEqual({
    success: true,
    data: {
      auditId: 'abc-123',
      status: 'scheduled'
    }
  })
})

test('should handle a network error', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/audits', () => {
      return HttpResponse.error()
    })
  )

  const response = await requestAudit('xcelera-dev', 'fake-token', context)

  expect(response).toEqual({
    success: false,
    error: {
      code: 'network_error',
      message: 'Could not reach the xcelera API.',
      hint: expect.stringContaining('XCELERA_API_URL'),
      details: 'Failed to fetch'
    }
  })
})

test('should pass through an API error verbatim', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/audits', () => {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'invalid_token',
            message: 'Invalid API token',
            hint: 'You must provide a valid Bearer token'
          }
        },
        { status: 401 }
      )
    })
  )

  const response = await requestAudit('xcelera-dev', 'fake-token', context)

  expect(response).toEqual({
    success: false,
    retryAfterSeconds: undefined,
    error: {
      code: 'invalid_token',
      message: 'Invalid API token',
      hint: 'You must provide a valid Bearer token'
    }
  })
})

test('should shape a non-JSON server error like an API error', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/audits', () => {
      return HttpResponse.text('Bad things happened', { status: 500 })
    })
  )

  const response = await requestAudit('xcelera-dev', 'fake-token', context)

  expect(response).toMatchObject({
    success: false,
    error: {
      code: 'http_error',
      message: 'Request failed: 500 Internal Server Error',
      details: 'Bad things happened'
    }
  })
})

test('should shape a JSON error body that is not the success:false envelope', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/audits', () => {
      return HttpResponse.json({ message: 'boom' }, { status: 500 })
    })
  )

  const response = await requestAudit('xcelera-dev', 'fake-token', context)

  expect(response).toMatchObject({
    success: false,
    error: {
      code: 'http_error',
      message: 'Request failed: 500 Internal Server Error',
      details: JSON.stringify({ message: 'boom' })
    }
  })
})

test('should not throw on a 200 response with an invalid JSON body', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/audits', () => {
      return HttpResponse.text('not json', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })
  )

  const response = await requestAudit('xcelera-dev', 'fake-token', context)

  expect(response).toMatchObject({
    success: false,
    error: { code: 'invalid_response' }
  })
})

test('should surface Retry-After from a rate limit', async () => {
  server.use(
    http.get('https://xcelera.dev/api/v1/audits/abc-123', () => {
      return HttpResponse.text('Too many requests', {
        status: 429,
        headers: { 'Retry-After': '30' }
      })
    })
  )

  const response = await getAudit('fake-token', { auditId: 'abc-123' })

  expect(response).toMatchObject({
    success: false,
    retryAfterSeconds: 30,
    error: { code: 'rate_limited' }
  })
})

test('should look an audit up by ref selectors', async () => {
  server.use(
    http.get('https://xcelera.dev/api/v1/audits', ({ request }) => {
      const url = new URL(request.url)
      expect(url.searchParams.get('ref')).toBe('example-com')
      expect(url.searchParams.get('prNumber')).toBe('42')
      expect(url.searchParams.has('gitHash')).toBe(false)

      return HttpResponse.json({ success: true, data: succeededAudit() })
    })
  )

  const response = await getAudit('fake-token', {
    ref: 'example-com',
    prNumber: '42'
  })

  expect(response.success).toBe(true)
})

test('should honour XCELERA_API_URL', async () => {
  process.env.XCELERA_API_URL = 'http://localhost:3000'
  server.use(
    http.get('http://localhost:3000/api/v1/audits/abc-123', () =>
      HttpResponse.json({ success: true, data: succeededAudit() })
    )
  )

  const response = await getAudit('fake-token', { auditId: 'abc-123' })

  expect(response.success).toBe(true)
})
