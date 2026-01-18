#!/usr/bin/env node
/* istanbul ignore file */

import { parseArgs } from 'node:util'
import { runAuditCommand } from './lib/commands/audit.js'

const options = {
  ref: {
    type: 'string' as const,
    required: true
  },
  token: {
    type: 'string' as const,
    required: true,
    default: process.env.XCELERA_TOKEN
  },
  'cookie-file': {
    type: 'string' as const
  },
  cookie: {
    type: 'string' as const,
    multiple: true
  },
  header: {
    type: 'string' as const,
    multiple: true
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

const { ref, token, cookie, header } = values
const cookieFile = values['cookie-file'] as string | undefined

if (!ref) {
  console.error(
    'Page ref is required. Use --ref <ref> to specify the page reference to audit. This can be found on the page definition in the xcelera dashboard.'
  )
  process.exit(1)
}

if (!token) {
  console.error(
    'A token is required. Use --token or set XCELERA_TOKEN environment variable.'
  )
  process.exit(1)
}

const result = await runAuditCommand(ref, token, {
  cookieFile,
  cookies: cookie as string[] | undefined,
  headers: header as string[] | undefined
})
result.output.forEach((line: string) => console.log(line))
result.errors.forEach((line: string) => console.error(line))
process.exit(result.exitCode)

function printHelp() {
  console.log('Usage: xcelera audit --ref <ref> [options]')
  console.log('')
  console.log('Options:')
  console.log('  --token <token>    The xcelera API token.')
  console.log(
    '                     Can also be set with XCELERA_TOKEN env var.'
  )
  console.log('  --ref <ref>        The reference of the page to audit.')
  console.log('')
  console.log('Authentication (for pages behind login):')
  console.log('  --cookie <cookie>  Cookie in "name=value" format.')
  console.log('                     Can be specified multiple times.')
  console.log('  --header <header>  Header in "Name: Value" format.')
  console.log('                     Can be specified multiple times.')
  console.log('  --cookie-file <path> Netscape cookie file (cookies.txt).')
  console.log(
    '                     Expired cookies are ignored with a warning.'
  )
  console.log('')
  console.log('Examples:')
  console.log('  # Basic audit')
  console.log('  xcelera audit --ref example-page-xdfd')
  console.log('')
  console.log('  # With session cookie')
  console.log(
    '  xcelera audit --ref example-page-xdfd --cookie "session=abc123"'
  )
  console.log('')
  console.log('  # With bearer token')
  console.log('  xcelera audit --ref example-page-xdfd \\')
  console.log('    --header "Authorization: Bearer eyJhbG..."')
  console.log('')
  console.log('  # Multiple cookies')
  console.log('  xcelera audit --ref example-page-xdfd \\')
  console.log('    --cookie "session=abc123" --cookie "csrf=xyz"')
  console.log('')
  console.log('  # With cookie file (Netscape cookies.txt format)')
  console.log(
    '  xcelera audit --ref example-page-xdfd --cookie-file ./cookies.txt'
  )
  console.log('')
}
