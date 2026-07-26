import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SimpleGit, simpleGit } from 'simple-git'
import type { AuditPayload } from '../types/index.js'

interface TempDir {
  dir: string
  cleanup: () => void
}

interface TempGitRepo extends TempDir {
  git: SimpleGit
}

interface InitGitRepoOptions {
  remoteUrl?: string | null
  userName?: string
  initialCommitMessage?: string
}

/**
 * Helper to run a test within a temporary git repo context.
 * Automatically changes to the repo directory and cleans up after.
 */
export async function withTempGitRepo<T>(
  fn: (repo: TempGitRepo) => Promise<T>,
  options: InitGitRepoOptions = {}
): Promise<T> {
  const originalCwd = process.cwd()
  const repo = await createTempGitRepo(options)

  try {
    process.chdir(repo.dir)
    return await fn(repo)
  } finally {
    process.chdir(originalCwd)
    repo.cleanup()
  }
}

/**
 * Helper to run a test within a temporary directory (no git).
 * Automatically changes to the directory and cleans up after.
 */
export async function withTempDir<T>(
  fn: (tempDir: TempDir) => Promise<T>
): Promise<T> {
  const originalCwd = process.cwd()
  const tempDir = createTempDir()

  try {
    process.chdir(tempDir.dir)
    return await fn(tempDir)
  } finally {
    process.chdir(originalCwd)
    tempDir.cleanup()
  }
}

async function createTempGitRepo(
  options: InitGitRepoOptions = {}
): Promise<TempGitRepo> {
  const {
    remoteUrl = 'git@github.com:owner/repo.git',
    userName = 'Test User',
    initialCommitMessage = 'initial commit'
  } = options

  const { dir, cleanup } = createTempDir()
  const git = simpleGit(dir)

  await git.init()
  await git.addConfig('user.name', userName)

  writeFileSync(join(dir, 'README.md'), '# test repo\n')
  await git.add(['README.md'])
  await git.commit(initialCommitMessage)

  if (remoteUrl) {
    await git.addRemote('origin', remoteUrl)
  }

  return {
    dir,
    git,
    cleanup
  }
}

function createTempDir(): TempDir {
  const dir = mkdtempSync(join(tmpdir(), 'xcelera-test'))
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  }
}

/** A succeeded audit as GET /api/v1/audits returns it. */
export function succeededAudit(
  overrides: Partial<AuditPayload> = {}
): AuditPayload {
  return {
    auditId: 'abc-123',
    ref: 'example-com',
    name: 'Example',
    url: 'https://example.com',
    status: 'Succeeded',
    runAt: '2026-07-26T00:00:00.000Z',
    source: 'Api',
    git: { hash: 'deadbeef', branch: 'main' },
    metrics: {
      categories: {
        performance: { raw: 82, display: 82, rating: 'needs-improvement' },
        accessibility: { raw: 95, display: 95, rating: 'good' },
        bestPractices: { raw: 100, display: 100, rating: 'good' },
        seo: { raw: 90, display: 90, rating: 'good' }
      },
      audits: {
        lcp: { raw: 2400, display: '2.4s', rating: 'needs-improvement' },
        tbt: { raw: 120, display: '120ms', rating: 'good' },
        cls: { raw: 0.02, display: 0.02, rating: 'good' },
        fcp: { raw: 1500, display: '1.5s', rating: 'good' },
        si: { raw: 3000, display: '3.0s', rating: 'needs-improvement' }
      }
    },
    insights: [
      {
        id: 'render-blocking-insight',
        title: 'Render-blocking requests',
        score: 0.4,
        metricSavings: { FCP: 300, LCP: 450 }
      }
    ],
    windowed: false,
    scoreImputed: false,
    reportUrl: 'https://reports.example.com/abc-123',
    ...overrides
  }
}
