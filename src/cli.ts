#!/usr/bin/env node
/* istanbul ignore file */

import { parseArgs } from 'node:util'
import { runAuditCommand } from './lib/commands/audit.js'

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
  process.exit(0)
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

const result = await runAuditCommand(url, token)
result.output.forEach((line: string) => console.log(line))
result.errors.forEach((line: string) => console.error(line))
process.exit(result.exitCode)

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
