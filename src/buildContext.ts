import envCi from "env-ci"
import { inferGitContext } from "./git.js"
import { BuildContext } from "./types/index.js"

export async function inferBuildContext(): Promise<BuildContext> {
    const ciEnv = envCi()
  const gitContext = {
    ...(await inferGitContext()),
    branch: ('prBranch' in ciEnv && ciEnv.prBranch ? ciEnv.prBranch : ciEnv.branch) ?? undefined,
  }
  const buildContext = {
    service: ciEnv.isCi ? ciEnv.service : 'unknown',
    prNumber: 'pr' in ciEnv ? ciEnv.pr : undefined,
    buildNumber: 'build' in ciEnv ? ciEnv.build : undefined,
    buildUrl: 'buildUrl' in ciEnv ? ciEnv.buildUrl : undefined,
    git: gitContext,
  }

  console.log('🔍 Inferred build context:')
  if (buildContext.service) {
    console.log(`   • service: ${buildContext.service}`)
  }
  console.log(`   • repository: ${gitContext.owner}/${gitContext.repo}`)
  console.log(`   • branch: ${gitContext.branch}`)
  console.log(`   • commit: ${gitContext.commit.hash}`)
  console.log('');
  return buildContext
}