import { execSync } from 'node:child_process'
import parseGithubUrl from 'parse-github-url'
import type { GitContext } from './types/git.js'

export function inferGitContext(): GitContext {
  if (!isGitRepository()) {
    throw new Error('Not git repository detected.')
  }

  const remoteUrl = getRemoteUrl()

  const parsed = parseGithubUrl(remoteUrl)
  if (!parsed || !parsed.owner || !parsed.repo) {
    throw new Error(
      `Could not parse GitHub URL: ${remoteUrl}. Expected format: https://github.com/owner/repo or git@github.com:owner/repo`
    )
  }

  const { owner, repo } = parsed

  const sha = getCurrentSha()

  // repo is parsed as owner/repo but we want to use just the repo name
  const repoName = repo.replace(`${owner}/`, '')

  return { owner, repo: repoName, sha }
}

function isGitRepository(): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function getRemoteUrl(): string {
  try {
    const remoteUrl = execSync('git remote get-url origin', {
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim()

    if (!remoteUrl) {
      throw new Error('No origin remote found')
    }

    return remoteUrl
  } catch {
    throw new Error(
      'Could not determine git remote URL. Please ensure you have an origin remote configured.'
    )
  }
}

function getCurrentSha(): string {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim()
  } catch {
    throw new Error('Could not determine current commit SHA')
  }
}
