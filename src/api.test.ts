import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { requestAudit } from './api.js'

const server = setupServer()
server.listen()

beforeEach(() => {
  server.resetHandlers()
})

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
    repo: 'xcelera',
    sha: '123'
  })

  expect(response).toEqual({
    auditId: 'abc-123',
    status: 'scheduled'
  })
})

test('should handle a network error', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/audit', () => {
      return HttpResponse.error()
    })
  )

  const response = requestAudit('https://xcelera.dev', 'fake-token', {
    owner: 'xcelera',
    repo: 'xcelera',
    sha: '123'
  })

  await expect(response).rejects.toThrow('Network error')
})
