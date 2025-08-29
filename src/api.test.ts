import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { requestAudit } from './api.js'

const server = setupServer()
server.listen()
beforeEach(() => server.resetHandlers())
afterAll(() => server.close())

test('should be able to request an audit', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/audit', () => {
      return HttpResponse.json({
        auditId: 'abc-123',
        status: 'scheduled'
      })
    })
  )

  const response = await requestAudit('https://xcelera.dev', 'fake-token', {
    owner: 'xcelera',
    repo: 'cli',
    sha: '123'
  })

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
    http.post('https://xcelera.dev/api/v1/audit', () => {
      return HttpResponse.error()
    })
  )

  const response = await requestAudit('https://xcelera.dev', 'fake-token', {
    owner: 'xcelera',
    repo: 'cli',
    sha: '123'
  })

  expect(response).toEqual({
    success: false,
    error: {
      message: 'Network error',
      details: 'Failed to fetch'
    }
  })
})

test('should handle an expected API error', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/audit', () => {
      return HttpResponse.json(
        {
          error: 'Invalid API token'
        },
        { status: 401 }
      )
    })
  )

  const response = await requestAudit('https://xcelera.dev', 'fake-token', {
    owner: 'xcelera',
    repo: 'cli',
    sha: '123'
  })

  expect(response).toEqual({
    success: false,
    error: {
      message: 'Invalid API token',
      code: 401
    }
  })
})

test('should handle an unexpected API error', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/audit', () => {
      return HttpResponse.text('Bad things happened', { status: 500 })
    })
  )

  const response = requestAudit('https://xcelera.dev', 'fake-token', {
    owner: 'xcelera',
    repo: 'cli',
    sha: '123'
  })

  await expect(response).rejects.toThrow(
    'Operation failed: 500 Internal Server Error - Bad things happened'
  )
})
