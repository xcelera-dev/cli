import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test
} from '@jest/globals'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { withTempGitRepo } from '../test-utils.js'
import { runAuditCommand } from './audit.js'

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('runAuditCommand', () => {
  test('successful audit returns correct output', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audit', () => {
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
      const result = await runAuditCommand('https://example.com', 'test-token')

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('🔍 Inferred build context:')
      expect(result.output).toContain('   • repository: owner/repo')
      expect(result.output).toContain('✅ Audit scheduled successfully!')
      expect(result.errors).toHaveLength(0)
    })
  })

  test('successful audit with GitHub integration', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audit', () => {
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

    const result = await runAuditCommand('https://example.com', 'test-token')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('✅ Audit scheduled successfully!')
    expect(result.output).toContain('✅ GitHub integration detected!')
    expect(result.errors).toHaveLength(0)
  })

  test('API error returns correct exit code and message', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audit', () => {
        return HttpResponse.json(
          {
            success: false,
            error: {
              message: 'Invalid token',
              details: 'Token expired'
            }
          },
          { status: 401 }
        )
      })
    )

    const result = await runAuditCommand('https://example.com', 'bad-token')

    expect(result.exitCode).toBe(1)
    expect(result.errors).toContain('❌ Unable to schedule audit :(')
    expect(result.errors).toContain(' ↳ Invalid token')
    expect(result.errors).toContain(' ↳ Token expired')
  })

  test('no git repo returns correct error', async () => {
    await withTempGitRepo(
      async () => {
        const result = await runAuditCommand('https://example.com', 'token')

        expect(result.exitCode).toBe(1)
        expect(result.errors[0]).toMatch(/Could not determine git remote URL/)
      },
      { remoteUrl: null }
    )
  })

  test('misconfigured GitHub integration shows warning', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audit', () => {
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
    const result = await runAuditCommand('https://example.com', 'test-token')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('✅ Audit scheduled successfully!')
    expect(result.errors).toContain('⚠️ GitHub integration is misconfigured.')
    expect(result.errors).toContain(
      'The xcelera.dev GitHub app is installed, but it does not have access to this repository.'
    )
  })

  test('GitHub integration error shows warning', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audit', () => {
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

    const result = await runAuditCommand('https://example.com', 'test-token')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('✅ Audit scheduled successfully!')
    expect(result.errors).toContain(
      '⚠️ Something went wrong with the GitHub integration.'
    )
  })

  test('handles unexpected errors', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audit', () => {
        throw new Error('Unexpected error')
      })
    )

    const result = await runAuditCommand('https://example.com', 'test-token')

    expect(result.exitCode).toBe(1)
    expect(result.errors[0]).toContain('❌')
    // should include stack trace
    expect(result.errors).toContainEqual(expect.stringMatching(/at /))
  })

  test('shows auth detected message when cookie provided', async () => {
    server.use(
      http.post('https://xcelera.dev/api/v1/audit', () => {
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

    const result = await runAuditCommand('https://example.com', 'test-token', {
      cookies: ['session=abc123']
    })

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('🔐 Authentication credentials detected')
    expect(result.output).toContain('✅ Audit scheduled successfully!')
  })

  test('fails with invalid auth JSON', async () => {
    const result = await runAuditCommand('https://example.com', 'test-token', {
      authJson: 'not valid json'
    })

    expect(result.exitCode).toBe(1)
    expect(result.errors[0]).toContain('--auth option contains invalid JSON')
  })

  test('fails with invalid cookie format', async () => {
    const result = await runAuditCommand('https://example.com', 'test-token', {
      cookies: ['invalid-cookie-no-equals']
    })

    expect(result.exitCode).toBe(1)
    expect(result.errors[0]).toContain('Invalid cookie format')
    expect(result.errors[0]).toContain('Expected "name=value"')
  })

  test('fails with invalid header format', async () => {
    const result = await runAuditCommand('https://example.com', 'test-token', {
      headers: ['InvalidHeaderNoColon']
    })

    expect(result.exitCode).toBe(1)
    expect(result.errors[0]).toContain('Invalid header format')
    expect(result.errors[0]).toContain('Expected "Name: Value"')
  })
})
