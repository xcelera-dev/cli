import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import { simpleGit } from 'simple-git'
import { inferGitContext, isGitRepository } from './git.js'

describe('git', () => {
  let repoDir: string
  const originalCwd = process.cwd()

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'xcelera-git-tmp'))
    process.chdir(repoDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(repoDir, { recursive: true, force: true })
  })

  test('checks if the current directory is a git repository', async () => {
    await expect(isGitRepository()).resolves.toBe(false)

    await initGitRepo()
    await expect(isGitRepository()).resolves.toBe(true)
  })

  test('infers git context', async () => {
    await initGitRepo()
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

  test('handles error when not in a git repository', async () => {
    await expect(inferGitContext()).rejects.toThrow(
      'No git repository detected.'
    )
  })

  test('handles error when remote URL cannot be determined', async () => {
    await initGitRepo({ remoteUrl: null })
    await expect(inferGitContext()).rejects.toThrow(
      'Could not determine git remote URL. Please ensure you have an origin remote configured.'
    )
  })

  test('handles error when remote URL cannot be parsed', async () => {
    await initGitRepo({ remoteUrl: 'invalid-url' })
    await expect(inferGitContext()).rejects.toThrow(
      /Could not parse GitHub URL: invalid-url[\s\S]*Expected format: https:\/\/github\.com\/owner\/repo or git@github\.com:owner\/repo/
    )
  })

  async function initGitRepo({
    remoteUrl = 'git@github.com:owner/repo.git'
  }: {
    remoteUrl?: string | null
  } = {}) {
    const git = simpleGit(repoDir)

    await git.init()
    await git.addConfig('user.name', 'Test User')
    await git.addConfig('user.email', 'test@example.com')

    writeFileSync(join(repoDir, 'README.md'), '# test repo\n')
    await git.add(['README.md'])
    await git.commit('initial commit')

    if (remoteUrl) {
      await git.addRemote('origin', remoteUrl)
    }
    return git
  }
})
