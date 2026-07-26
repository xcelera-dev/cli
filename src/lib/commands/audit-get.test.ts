import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'

import { succeededAudit } from '../test-utils.js'
import { runAuditGetCommand } from './audit-get.js'

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

test('reports the latest audit for a ref', async () => {
  server.use(
    http.get('https://xcelera.dev/api/v1/audits', () =>
      HttpResponse.json({ success: true, data: succeededAudit() })
    )
  )

  const result = await runAuditGetCommand('test-token', {
    selector: { ref: 'example-com' }
  })

  expect(result.exitCode).toBe(0)
  expect(result.auditId).toBe('abc-123')
  expect(result.output).toContainEqual(expect.stringContaining('82'))
  expect(result.output).toContainEqual(expect.stringContaining('2.4s'))
  expect(result.output).toContainEqual(
    expect.stringContaining(
      'Render-blocking requests — saves FCP 300ms, LCP 450ms'
    )
  )
})

test('prints code, message and hint when the ref is unknown', async () => {
  server.use(
    http.get('https://xcelera.dev/api/v1/audits', () =>
      HttpResponse.json(
        {
          success: false,
          error: {
            code: 'page_not_found',
            message: 'No page found for ref "nope".',
            hint: 'Call list_pages to see valid refs.'
          }
        },
        { status: 404 }
      )
    )
  )

  const result = await runAuditGetCommand('test-token', {
    selector: { ref: 'nope' }
  })

  expect(result.exitCode).toBe(1)
  expect(result.errors).toEqual([
    '❌ Unable to fetch audit :(',
    ' ↳ [page_not_found] No page found for ref "nope".',
    ' ↳ Call list_pages to see valid refs.'
  ])
})

test('says so when the audit has not finished, without failing', async () => {
  server.use(
    http.get('https://xcelera.dev/api/v1/audits/abc-123', () =>
      HttpResponse.json({
        success: true,
        data: succeededAudit({ status: 'Running' })
      })
    )
  )

  const result = await runAuditGetCommand('test-token', {
    selector: { auditId: 'abc-123' }
  })

  expect(result.exitCode).toBe(0)
  expect(result.output[0]).toContain('is running')
})

test('--json prints the payload and fails on a failed audit', async () => {
  server.use(
    http.get('https://xcelera.dev/api/v1/audits/abc-123', () =>
      HttpResponse.json({
        success: true,
        data: succeededAudit({ status: 'Failed' })
      })
    )
  )

  const result = await runAuditGetCommand('test-token', {
    selector: { auditId: 'abc-123' },
    json: true
  })

  expect(result.exitCode).toBe(1)
  expect(JSON.parse(result.output.join('\n'))).toMatchObject({
    auditId: 'abc-123',
    status: 'Failed'
  })
})
