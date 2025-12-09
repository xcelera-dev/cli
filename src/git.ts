import parseGithubUrl from 'parse-github-url'
import { simpleGit } from 'simple-git'
import type { CommitInfo, GitContext } from './types/index.js'

export async function inferGitContext(): Promise<GitContext> {
  if (!(await isGitRepository())) {
    throw new Error('No git repository detected.')
  }

  const remoteUrl = await getRemoteUrl()

  const parsed = parseGithubUrl(remoteUrl)
  if (!parsed || !parsed.owner || !parsed.repo) {
    throw new Error(
      `Could not parse GitHub URL: ${remoteUrl}. Expected format: https://github.com/owner/repo or git@github.com:owner/repo`
    )
  }

  const { owner, repo } = parsed
  // repo is parsed as owner/repo but we want to use just the repo name
  const repoName = repo.replace(`${owner}/`, '')
  const commitInfo = await getCommit()

  return { owner, repo: repoName, commit: commitInfo }
}

async function getRemoteUrl(): Promise<string> {
  try {
    const remoteUrl = await simpleGit().remote(['get-url', 'origin'])
    if (!remoteUrl) {
      throw new Error('No origin remote found')
    }
    return remoteUrl
  } catch (error) {
    throw new Error(
      'Could not determine git remote URL. Please ensure you have an origin remote configured.',
      { cause: error }
    )
  }
}

export async function isGitRepository(): Promise<boolean> {
  return simpleGit().checkIsRepo()
}

async function getCommit(hash = 'HEAD'): Promise<CommitInfo> {
  // format: %H: commit hash, %s: subject, %an: author name, %ae: author email, %ai: author date
  const commit = await simpleGit().show([
    hash,
    '--no-patch',
    '--format=%H|%s|%an|%ae|%ai'
  ])
  const [resolvedHash, message, author_name, author_email, date] = commit
    .trim()
    .split('|')

  if (!resolvedHash) {
    throw new Error(`No commit found for ${hash}`)
  }
  return {
    hash: resolvedHash,
    message: message,
    author: author_name || 'Unknown',
    email: author_email || '',
    date: date ? new Date(date).toISOString() : new Date().toISOString()
  }
}
