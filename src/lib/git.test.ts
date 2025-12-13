import { describe, expect, test } from '@jest/globals'
import { inferGitContext, isGitRepository } from './git.js'
import { withTempDir, withTempGitRepo } from './test-utils.js'

describe('git', () => {
  test('detects when not in a git repository', async () => {
    await withTempDir(async () => {
      await expect(isGitRepository()).resolves.toBe(false)
    })
  })

  test('detects when in a git repository', async () => {
    await withTempGitRepo(async () => {
      await expect(isGitRepository()).resolves.toBe(true)
    })
  })

  test('infers git context', async () => {
    await withTempGitRepo(async () => {
      const context = await inferGitContext()

      expect(context.owner).toBe('owner')
      expect(context.repo).toBe('repo')
      expect(context.commit).toEqual(
        expect.objectContaining({
          hash: expect.stringMatching(/^[0-9a-f]{40}$/),
          message: 'initial commit',
          author: 'Test User',
          email: 'test@example.com',
          date: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
          )
        })
      )
    })
  })

  test('handles commit messages containing pipe characters', async () => {
    await withTempGitRepo(
      async () => {
        const context = await inferGitContext()

        expect(context.commit.message).toBe('fix: handle edge case | add tests')
      },
      { initialCommitMessage: 'fix: handle edge case | add tests' }
    )
  })

  test('handles error when not in a git repository', async () => {
    await withTempDir(async () => {
      await expect(inferGitContext()).rejects.toThrow(
        'No git repository detected.'
      )
    })
  })

  test('handles error when remote URL cannot be determined', async () => {
    await withTempGitRepo(
      async () => {
        await expect(inferGitContext()).rejects.toThrow(
          'Could not determine git remote URL. Please ensure you have an origin remote configured.'
        )
      },
      { remoteUrl: null }
    )
  })

  test('handles error when remote URL cannot be parsed', async () => {
    await withTempGitRepo(
      async () => {
        await expect(inferGitContext()).rejects.toThrow(
          /Could not parse GitHub URL: invalid-url[\s\S]*Expected format: https:\/\/github\.com\/owner\/repo or git@github\.com:owner\/repo/
        )
      },
      { remoteUrl: 'invalid-url' }
    )
  })
})
