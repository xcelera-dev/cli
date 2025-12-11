import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SimpleGit, simpleGit } from 'simple-git'

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
  userEmail?: string
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
    userEmail = 'test@example.com',
    initialCommitMessage = 'initial commit'
  } = options

  const { dir, cleanup } = createTempDir()
  const git = simpleGit(dir)

  await git.init()
  await git.addConfig('user.name', userName)
  await git.addConfig('user.email', userEmail)

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
