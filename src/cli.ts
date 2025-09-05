#!/usr/bin/env node

import { parseArgs } from 'node:util'

import { requestAudit } from './api.js'
import { inferGitContext } from './git.js'

const options = {
  url: {
    type: 'string' as const,
    required: true
  },
  token: {
    type: 'string' as const,
    required: true,
    default: process.env.XCELERA_TOKEN
  }
}

const { positionals, values } = parseArgs({
  options,
  allowPositionals: true,
  args: process.argv.slice(2)
})

const command = positionals[0]

if (!command) {
  console.error('A command is required. Only "audit" is currently supported.')
  printHelp()
  process.exit(1)
}

if (command === 'help') {
  printHelp()
}

if (command !== 'audit') {
  console.error('Invalid command. Only "audit" is currently supported.')
  printHelp()
  process.exit(1)
}

const { url, token } = values

if (!url) {
  console.error('URL is required. Use --url <url> to specify the URL to audit.')
  process.exit(1)
}

if (!token) {
  console.error(
    'A token is required. Use --token or set XCELERA_TOKEN environment variable.'
  )
  process.exit(1)
}

try {
  const githubContext = inferGitContext()
  console.log('🔍 Inferred GitHub context:')
  console.log(`   • repository: ${githubContext.owner}/${githubContext.repo}`)
  console.log(`   • sha: ${githubContext.sha}`)
  console.log('')

  const response = await requestAudit(url, token, githubContext)
  if (!response.success) {
    const { message, details } = response.error
    console.error('❌ Unabled to schedule audit :(')
    console.error(` ↳ ${message}`)
    if (details) {
      console.error(` ↳ ${details}`)
    }
    process.exit(1)
  }
  const { auditId, status, integrations } = response.data

  console.log('✅ Audit scheduled successfully!')
  console.log(`Audit ID: ${auditId}`)
  console.log(`Status: ${status}`)
  if (integrations) {
    console.log('Integration detected:')
    console.log(` ↳ GitHub: ${integrations.github.installationId}`)
    console.log(` ↳ GitHub: ${integrations.github.checkRunId}`)
    console.log(` ↳ GitHub: ${integrations.github.hasRepoAccess}`)
  }
} catch (error) {
  const errorMessage =
    error instanceof Error ? error.message : 'Unknown error occurred'
  console.error(`❌ ${errorMessage}`)
  process.exit(1)
}

function printHelp() {
  console.log('Usage: xcelera audit --url <url> [--token <token>]')
  console.log('')
  console.log('Options:')
  console.log(
    '  --token <token>  The xcelera API token to use for authentication.'
  )
  console.log('Can also be set with the XCELERA_TOKEN environment variable.')
  console.log('  --url <url>      The URL to audit.')
  console.log('')
}
