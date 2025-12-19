import envCi from 'env-ci'
import { BuildContext } from '../types/index.js'
import { inferGitContext } from './git.js'

export async function inferBuildContext(): Promise<BuildContext> {
  const ciEnv = envCi()
  const gitContext = await inferGitContext()
  const branch =
    ('prBranch' in ciEnv && ciEnv.prBranch ? ciEnv.prBranch : ciEnv.branch) ??
    undefined

  return {
    service: ciEnv.isCi ? ciEnv.service : 'unknown',
    prNumber: 'pr' in ciEnv ? ciEnv.pr : undefined,
    buildNumber: 'build' in ciEnv ? ciEnv.build : undefined,
    buildUrl: 'buildUrl' in ciEnv ? ciEnv.buildUrl : undefined,
    git: gitContext ? { ...gitContext, branch } : undefined
  }
}
