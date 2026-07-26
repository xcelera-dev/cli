import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'

import { dispatch } from './dispatch.js'
import { succeededAudit } from './test-utils.js'

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  delete process.env.XCELERA_TOKEN
})
afterAll(() => server.close())

test('bare `audit` still runs an audit', async () => {
  server.use(
    http.post('https://xcelera.dev/api/v1/audits', () =>
      HttpResponse.json({
        success: true,
        data: { auditId: 'abc-123', status: 'scheduled', integrations: {} }
      })
    )
  )

  const result = await dispatch([
    'audit',
    '--ref',
    'example-com',
    '--token',
    'test-token'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.output).toContain('✅ Audit scheduled successfully!')
})

test('`audit get` dispatches to the read command', async () => {
  server.use(
    http.get('https://xcelera.dev/api/v1/audits', () =>
      HttpResponse.json({ success: true, data: succeededAudit() })
    )
  )

  const result = await dispatch([
    'audit',
    'get',
    '--ref',
    'example-com',
    '--token',
    'test-token'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.auditId).toBe('abc-123')
})

test('falls back to XCELERA_TOKEN', async () => {
  process.env.XCELERA_TOKEN = 'env-token'
  server.use(
    http.get('https://xcelera.dev/api/v1/audits', ({ request }) => {
      expect(request.headers.get('Authorization')).toBe('Bearer env-token')
      return HttpResponse.json({ success: true, data: succeededAudit() })
    })
  )

  const result = await dispatch(['audit', 'get', '--ref', 'example-com'])

  expect(result.exitCode).toBe(0)
})

test('requires a token', async () => {
  const result = await dispatch(['audit', 'get', '--ref', 'example-com'])

  expect(result.exitCode).toBe(1)
  expect(result.errors[0]).toContain('XCELERA_TOKEN')
})

test('requires a ref to run an audit', async () => {
  const result = await dispatch(['audit', 'run', '--token', 'test-token'])

  expect(result.exitCode).toBe(1)
  expect(result.errors[0]).toContain('Page ref is required')
})

test('requires a selector to get an audit', async () => {
  const result = await dispatch(['audit', 'get', '--token', 'test-token'])

  expect(result.exitCode).toBe(1)
  expect(result.errors[0]).toContain('--audit-id')
})

test('rejects a non-numeric timeout', async () => {
  const result = await dispatch([
    'audit',
    'run',
    '--ref',
    'example-com',
    '--token',
    'test-token',
    '--timeout',
    'soon'
  ])

  expect(result.exitCode).toBe(1)
  expect(result.errors[0]).toContain('--timeout must be a positive number')
})

test('reports an unknown option with the command help', async () => {
  const result = await dispatch([
    'audit',
    'get',
    '--token',
    'test-token',
    '--nope'
  ])

  expect(result.exitCode).toBe(1)
  expect(result.errors[0]).toContain("Unknown option '--nope'")
  expect(result.errors).toContainEqual(
    expect.stringContaining('Usage: xcelera audit get')
  )
})

test('reports an unknown command', async () => {
  const result = await dispatch(['page', 'list'])

  expect(result.exitCode).toBe(1)
  expect(result.errors[0]).toBe('Unknown command: "page list".')
})

test('rejects trailing command words', async () => {
  const result = await dispatch([
    'audit',
    'run',
    'extra',
    '--token',
    'test-token'
  ])

  expect(result.exitCode).toBe(1)
  expect(result.errors[0]).toContain('Unknown command: "audit run extra"')
})

test('lists every command with no arguments', async () => {
  const result = await dispatch([])

  expect(result.exitCode).toBe(0)
  expect(result.output).toContainEqual(expect.stringContaining('audit run'))
  expect(result.output).toContainEqual(expect.stringContaining('audit get'))
})

test('`help <noun> <verb>` prints that command', async () => {
  const result = await dispatch(['help', 'audit', 'get'])

  expect(result.exitCode).toBe(0)
  expect(result.output[0]).toContain('Usage: xcelera audit get')
})

test('`--help` prints the command it follows', async () => {
  const result = await dispatch(['audit', 'run', '--help'])

  expect(result.exitCode).toBe(0)
  expect(result.output[0]).toContain('Usage: xcelera audit run')
})
