import { writeFileSync } from 'node:fs'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import type { AuditStatus } from '../../types/index.js'
import {
  collectProgress,
  succeededAudit,
  withTempDir,
  withTempGitRepo
} from '../test-utils.js'
import { runAuditCommand } from './audit.js'

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('runAuditCommand', () => {
  test('successful audit returns correct output', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () => {
        return HttpResponse.json({
          success: true,
          data: {
            auditId: 'abc-123',
            status: 'scheduled',
            integrations: {}
          }
        })
      })
    )

    await withTempGitRepo(async (repo) => {
      const result = await runAuditCommand('example-com', 'test-token')

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('🔍 Inferred build context:')
      expect(result.output).toContain('   • repository: owner/repo')
      expect(result.output).toContain('✅ Audit scheduled successfully!')
      expect(result.errors).toHaveLength(0)
    })
  })

  test('successful audit with GitHub integration', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () => {
        return HttpResponse.json({
          success: true,
          data: {
            auditId: 'abc-123',
            status: 'scheduled',
            integrations: {
              github: {
                status: 'success',
                installationId: 123,
                checkRunId: 456
              }
            }
          }
        })
      })
    )

    const result = await runAuditCommand('example-com', 'test-token')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('✅ Audit scheduled successfully!')
    expect(result.output).toContain('✅ GitHub integration detected!')
    expect(result.errors).toHaveLength(0)
  })

  test('API error returns correct exit code and message', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'invalid_token',
              message: 'Invalid token',
              hint: 'Create a new token in Settings → API Tokens.',
              details: 'Token expired'
            }
          },
          { status: 401 }
        )
      })
    )

    const result = await runAuditCommand('example-com', 'bad-token')

    expect(result.exitCode).toBe(1)
    expect(result.errors).toContain('❌ Unable to schedule audit :(')
    expect(result.errors).toContain(' ↳ [invalid_token] Invalid token')
    expect(result.errors).toContain(
      ' ↳ Create a new token in Settings → API Tokens.'
    )
    expect(result.errors).toContain(' ↳ Token expired')
  })

  test('no git repo returns correct error', async () => {
    await withTempGitRepo(
      async () => {
        const result = await runAuditCommand('example-com', 'token')

        expect(result.exitCode).toBe(1)
        expect(result.errors[0]).toMatch(/Could not determine git remote URL/)
      },
      { remoteUrl: null }
    )
  })

  test('misconfigured GitHub integration shows warning', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () => {
        return HttpResponse.json({
          success: true,
          data: {
            auditId: 'abc-123',
            status: 'scheduled',
            integrations: {
              github: {
                status: 'misconfigured',
                reason: 'no_repo_access',
                installationId: 123
              }
            }
          }
        })
      })
    )
    const result = await runAuditCommand('example-com', 'test-token')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('✅ Audit scheduled successfully!')
    expect(result.errors).toContain('⚠️ GitHub integration is misconfigured.')
    expect(result.errors).toContain(
      'The xcelera.dev GitHub app is installed, but it does not have access to this repository.'
    )
  })

  test('GitHub integration error shows warning', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () => {
        return HttpResponse.json({
          success: true,
          data: {
            auditId: 'abc-123',
            status: 'scheduled',
            integrations: {
              github: {
                status: 'error'
              }
            }
          }
        })
      })
    )

    const result = await runAuditCommand('example-com', 'test-token')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('✅ Audit scheduled successfully!')
    expect(result.errors).toContain(
      '⚠️ Something went wrong with the GitHub integration.'
    )
  })

  test('reports a non-JSON server error rather than throwing', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () => {
        return new HttpResponse('Internal Server Error', { status: 500 })
      })
    )

    const result = await runAuditCommand('example-com', 'test-token')

    expect(result.exitCode).toBe(1)
    expect(result.errors).toContain('❌ Unable to schedule audit :(')
    expect(result.errors).toContainEqual(
      expect.stringContaining('[http_error] Request failed: 500')
    )
  })

  test('shows auth detected message when cookie provided', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () => {
        return HttpResponse.json({
          success: true,
          data: {
            auditId: 'abc-123',
            status: 'scheduled',
            integrations: {}
          }
        })
      })
    )

    const result = await runAuditCommand('example-com', 'test-token', {
      cookies: ['session=abc123']
    })

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('🔐 Authentication credentials detected')
    expect(result.output).toContain('✅ Audit scheduled successfully!')
  })

  test('fails with invalid cookie format', async () => {
    const result = await runAuditCommand('example-com', 'test-token', {
      cookies: ['invalid-cookie-no-equals']
    })

    expect(result.exitCode).toBe(1)
    expect(result.errors[0]).toContain('Invalid cookie format')
    expect(result.errors[0]).toContain('Expected "name=value"')
  })

  test('fails with invalid header format', async () => {
    const result = await runAuditCommand('example-com', 'test-token', {
      headers: ['InvalidHeaderNoColon']
    })

    expect(result.exitCode).toBe(1)
    expect(result.errors[0]).toContain('Invalid header format')
    expect(result.errors[0]).toContain('Expected "Name: Value"')
  })

  test('cookie file is parsed and cookies are sent to API', async () => {
    const cookieFileContents =
      '.example.com\tTRUE\t/\tFALSE\t9999999999\tsession\tabc123\n'

    server.use(
      http.post('https://xcelera.dev/api/v1/audits', async ({ request }) => {
        const body = await request.json()

        expect(body).toEqual(
          expect.objectContaining({
            auth: {
              cookies: [
                {
                  name: 'session',
                  value: 'abc123',
                  domain: '.example.com',
                  path: '/'
                }
              ]
            }
          })
        )

        return HttpResponse.json({
          success: true,
          data: {
            auditId: 'abc-123',
            status: 'scheduled',
            integrations: {}
          }
        })
      })
    )

    await withTempDir(async ({ dir }) => {
      const cookieFilePath = `${dir}/cookies.txt`
      writeFileSync(cookieFilePath, cookieFileContents, 'utf8')

      const result = await runAuditCommand('example-com', 'test-token', {
        cookieFile: cookieFilePath
      })

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('🔐 Authentication credentials detected')
    })
  })

  test('--wait polls until the audit succeeds and reports its scores', async () => {
    const statuses: AuditStatus[] = ['Scheduled', 'Running', 'Succeeded']
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () =>
        HttpResponse.json({
          success: true,
          data: { auditId: 'abc-123', status: 'scheduled', integrations: {} }
        })
      ),
      http.get('https://xcelera.dev/api/v1/audits/abc-123', () =>
        HttpResponse.json({
          success: true,
          data: succeededAudit({ status: statuses.shift() ?? 'Succeeded' })
        })
      )
    )

    const result = await runAuditCommand('example-com', 'test-token', {
      wait: true,
      pollIntervalMs: 0
    })

    expect(statuses).toHaveLength(0)
    expect(result.exitCode).toBe(0)
    expect(result.auditId).toBe('abc-123')
    expect(result.output).toContainEqual(expect.stringContaining('Performance'))
    expect(result.output).toContainEqual(
      expect.stringContaining('Render-blocking requests')
    )
  })

  test('--wait exits non-zero when the audit fails', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () =>
        HttpResponse.json({
          success: true,
          data: { auditId: 'abc-123', status: 'scheduled', integrations: {} }
        })
      ),
      http.get('https://xcelera.dev/api/v1/audits/abc-123', () =>
        HttpResponse.json({
          success: true,
          data: succeededAudit({ status: 'Failed' })
        })
      )
    )

    const result = await runAuditCommand('example-com', 'test-token', {
      wait: true,
      pollIntervalMs: 0
    })

    expect(result.exitCode).toBe(1)
    expect(result.errors).toContain('❌ Audit failed.')
  })

  test('--wait gives up at the timeout, pointing at the audit id', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () =>
        HttpResponse.json({
          success: true,
          data: { auditId: 'abc-123', status: 'scheduled', integrations: {} }
        })
      ),
      http.get('https://xcelera.dev/api/v1/audits/abc-123', () =>
        HttpResponse.json({
          success: true,
          data: succeededAudit({ status: 'Running' })
        })
      )
    )

    let clock = 0
    const result = await runAuditCommand('example-com', 'test-token', {
      wait: true,
      timeoutSeconds: 30,
      pollIntervalMs: 0,
      now: () => clock,
      sleep: async () => {
        clock += 20_000
      }
    })

    expect(result.exitCode).toBe(1)
    expect(result.errors).toContainEqual(
      expect.stringContaining('[wait_timeout]')
    )
    expect(result.errors).toContainEqual(
      expect.stringContaining('audit get --audit-id abc-123')
    )
  })

  test('streams every output line, in order, before returning', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () =>
        HttpResponse.json({
          success: true,
          data: { auditId: 'abc-123', status: 'scheduled', integrations: {} }
        })
      ),
      http.get('https://xcelera.dev/api/v1/audits/abc-123', () =>
        HttpResponse.json({ success: true, data: succeededAudit() })
      )
    )

    const progress = collectProgress()
    const result = await runAuditCommand('example-com', 'test-token', {
      wait: true,
      pollIntervalMs: 0,
      progress
    })

    expect(progress.lines).toEqual(result.output)
  })

  test('the scheduled message streams before the wait, not after it', async () => {
    const statuses: AuditStatus[] = ['Running', 'Succeeded']
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () =>
        HttpResponse.json({
          success: true,
          data: { auditId: 'abc-123', status: 'scheduled', integrations: {} }
        })
      ),
      http.get('https://xcelera.dev/api/v1/audits/abc-123', () =>
        HttpResponse.json({
          success: true,
          data: succeededAudit({ status: statuses.shift() ?? 'Succeeded' })
        })
      )
    )

    const progress = collectProgress()
    let streamedBeforePoll: string[] = []

    await runAuditCommand('example-com', 'test-token', {
      wait: true,
      pollIntervalMs: 0,
      progress,
      sleep: async () => {
        streamedBeforePoll = [...progress.events]
      }
    })

    expect(streamedBeforePoll).toContain(
      'line: ✅ Audit scheduled successfully!'
    )
    expect(streamedBeforePoll).not.toContainEqual(
      expect.stringContaining('Performance')
    )
  })

  test('--wait shows a status line per poll and clears it before the report', async () => {
    const statuses: AuditStatus[] = ['Scheduled', 'Running', 'Succeeded']
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () =>
        HttpResponse.json({
          success: true,
          data: { auditId: 'abc-123', status: 'scheduled', integrations: {} }
        })
      ),
      http.get('https://xcelera.dev/api/v1/audits/abc-123', () =>
        HttpResponse.json({
          success: true,
          data: succeededAudit({ status: statuses.shift() ?? 'Succeeded' })
        })
      )
    )

    const progress = collectProgress()
    let clock = 0
    await runAuditCommand('example-com', 'test-token', {
      wait: true,
      pollIntervalMs: 0,
      progress,
      now: () => clock,
      sleep: async () => {
        clock += 42_000
      }
    })

    expect(progress.events).toContain('status: ⏳ Scheduled — 0:00 elapsed')
    expect(progress.events).toContain('status: ⏳ Running — 0:42 elapsed')

    const finishedAt = progress.events.indexOf('finish')
    const reportAt = progress.events.findIndex((event) =>
      event.includes('Performance')
    )
    expect(finishedAt).toBeGreaterThan(-1)
    expect(finishedAt).toBeLessThan(reportAt)
  })

  test('--json prints the scheduled audit and no build context', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audits', () =>
        HttpResponse.json({
          success: true,
          data: { auditId: 'abc-123', status: 'scheduled', integrations: {} }
        })
      )
    )

    const result = await runAuditCommand('example-com', 'test-token', {
      json: true
    })

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.output.join('\n'))).toMatchObject({
      auditId: 'abc-123'
    })
  })
})
