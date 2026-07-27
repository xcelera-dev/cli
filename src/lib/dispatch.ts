import { type ParseArgsConfig, parseArgs } from 'node:util'
import type { CommandResult } from '../types/index.js'
import {
  DEFAULT_WAIT_TIMEOUT_SECONDS,
  runAuditCommand
} from './commands/audit.js'
import { runAuditGetCommand } from './commands/audit-get.js'
import { runPageArchiveCommand } from './commands/page-archive.js'
import { runPageCreateCommand } from './commands/page-create.js'
import { runPageListCommand } from './commands/page-list.js'

type OptionsConfig = NonNullable<ParseArgsConfig['options']>
type OptionValues = Record<string, string | boolean | string[] | undefined>

type Command = {
  noun: string
  verb: string
  summary: string
  options: OptionsConfig
  help: string[]
  run: (values: OptionValues, token: string) => Promise<CommandResult>
}

/** The verb assumed when only a noun is given — `xcelera audit` is `audit run`. */
const DEFAULT_VERBS: Record<string, string> = {
  audit: 'run'
}

const TOKEN_OPTION: OptionsConfig = {
  token: { type: 'string' }
}

const AUTH_OPTIONS: OptionsConfig = {
  'cookie-file': { type: 'string' },
  cookie: { type: 'string', multiple: true },
  header: { type: 'string', multiple: true }
}

const SELECTOR_OPTIONS: OptionsConfig = {
  ref: { type: 'string' },
  'audit-id': { type: 'string' },
  'git-hash': { type: 'string' },
  pr: { type: 'string' }
}

const auditRun: Command = {
  noun: 'audit',
  verb: 'run',
  summary: 'Start an audit for a page',
  options: {
    ...TOKEN_OPTION,
    ...AUTH_OPTIONS,
    ref: { type: 'string' },
    wait: { type: 'boolean' },
    timeout: { type: 'string' },
    json: { type: 'boolean' }
  },
  help: [
    'Usage: xcelera audit run --ref <ref> [options]',
    '',
    'Starts an audit. Exits as soon as it is scheduled unless --wait is given.',
    '',
    'Options:',
    '  --ref <ref>          The reference of the page to audit. Required.',
    '  --token <token>      The xcelera API token.',
    '                       Can also be set with XCELERA_TOKEN.',
    '  --wait               Block until the audit finishes, then print results.',
    `  --timeout <seconds>  How long --wait waits (default ${DEFAULT_WAIT_TIMEOUT_SECONDS}).`,
    '  --json               Print the raw API response instead of a report.',
    '',
    'Authentication (for pages behind login):',
    '  --cookie <cookie>    Cookie in "name=value" format. Repeatable.',
    '  --header <header>    Header in "Name: Value" format. Repeatable.',
    '  --cookie-file <path> Netscape cookie file (cookies.txt).',
    '                       Expired cookies are ignored with a warning.',
    '',
    'Examples:',
    '  xcelera audit run --ref example-page-xdfd',
    '  xcelera audit run --ref example-page-xdfd --wait --timeout 900',
    '  xcelera audit run --ref example-page-xdfd --cookie "session=abc123"',
    '  xcelera audit run --ref example-page-xdfd \\',
    '    --header "Authorization: Bearer eyJhbG..."',
    '  xcelera audit run --ref example-page-xdfd --cookie-file ./cookies.txt'
  ],
  run: async (values, token) => {
    const ref = values.ref as string | undefined
    if (!ref) return missingRef()

    const timeout = parseTimeout(values.timeout as string | undefined)
    if ('error' in timeout) return timeout.error

    return runAuditCommand(ref, token, {
      cookieFile: values['cookie-file'] as string | undefined,
      cookies: values.cookie as string[] | undefined,
      headers: values.header as string[] | undefined,
      wait: values.wait === true,
      timeoutSeconds: timeout.seconds,
      json: values.json === true
    })
  }
}

const auditGet: Command = {
  noun: 'audit',
  verb: 'get',
  summary: 'Fetch an existing audit',
  options: {
    ...TOKEN_OPTION,
    ...SELECTOR_OPTIONS,
    json: { type: 'boolean' }
  },
  help: [
    'Usage: xcelera audit get [--ref <ref> | --audit-id <id>] [options]',
    '',
    'Fetches one audit without starting anything. A bare --ref returns the',
    'latest succeeded audit for that page.',
    '',
    'Options:',
    '  --ref <ref>          The reference of the page.',
    '  --audit-id <id>      Exact audit id. Takes precedence over --ref.',
    '  --git-hash <hash>    With --ref, the audit for this commit.',
    '  --pr <number>        With --ref, the audit for this pull request.',
    '  --token <token>      The xcelera API token.',
    '                       Can also be set with XCELERA_TOKEN.',
    '  --json               Print the raw API response instead of a report.',
    '',
    'Examples:',
    '  xcelera audit get --ref example-page-xdfd',
    '  xcelera audit get --ref example-page-xdfd --pr 42',
    '  xcelera audit get --audit-id ah7n75i5uxk6fce9wanzeq8d --json'
  ],
  run: async (values, token) => {
    const auditId = values['audit-id'] as string | undefined
    const ref = values.ref as string | undefined
    if (!auditId && !ref) {
      return failure([
        'Provide --audit-id, or --ref (optionally with --git-hash or --pr).'
      ])
    }

    return runAuditGetCommand(token, {
      selector: {
        auditId,
        ref,
        gitHash: values['git-hash'] as string | undefined,
        prNumber: values.pr as string | undefined
      },
      json: values.json === true
    })
  }
}

const pageList: Command = {
  noun: 'page',
  verb: 'list',
  summary: 'List the tracked pages and their latest scores',
  options: {
    ...TOKEN_OPTION,
    json: { type: 'boolean' },
    csv: { type: 'boolean' }
  },
  help: [
    'Usage: xcelera page list [options]',
    '',
    'Lists every page tracked by your organization, with the scores of its',
    'latest audit. This is how you find the refs the audit commands take.',
    '',
    'Options:',
    '  --token <token>      The xcelera API token.',
    '                       Can also be set with XCELERA_TOKEN.',
    '  --json               Print the raw API response instead of a table.',
    '  --csv                Print the pages as CSV instead of a table.',
    '',
    'Examples:',
    '  xcelera page list',
    '  xcelera page list --json',
    '  xcelera page list --csv > pages.csv'
  ],
  run: async (values, token) => {
    if (values.json === true && values.csv === true) {
      return failure(['Use either --json or --csv, not both.'])
    }

    return runPageListCommand(token, {
      json: values.json === true,
      csv: values.csv === true
    })
  }
}

const pageCreate: Command = {
  noun: 'page',
  verb: 'create',
  summary: 'Register a page to audit',
  options: {
    ...TOKEN_OPTION,
    url: { type: 'string' },
    name: { type: 'string' },
    device: { type: 'string' },
    region: { type: 'string' },
    json: { type: 'boolean' }
  },
  help: [
    'Usage: xcelera page create --url <url> [options]',
    '',
    'Registers a page and prints its ref. Registration is an upsert: the same',
    'url and device returns the page that already exists, so a deploy script',
    'can call this every run. An existing page keeps its own name, settings',
    'and schedule.',
    '',
    'The page has no audit schedule; audit it with `xcelera audit run`.',
    '',
    'Options:',
    '  --url <url>          The https url to track. Required.',
    '  --name <name>        A label for the page. Defaults to the url.',
    '  --device <device>    "mobile" or "desktop". Defaults to your',
    '                       organization setting. Part of page identity.',
    '  --region <region>    Where the audit runs from. Defaults to your',
    '                       organization setting.',
    '  --token <token>      The xcelera API token.',
    '                       Can also be set with XCELERA_TOKEN.',
    '  --json               Print the raw API response.',
    '',
    'Examples:',
    '  xcelera page create --url https://example.com',
    '  xcelera page create --url https://example.com --name Home --device desktop'
  ],
  run: async (values, token) => {
    const url = values.url as string | undefined
    if (!url) {
      return failure(['A url is required. Use --url https://example.com.'])
    }

    const device = parseDevice(values.device as string | undefined)
    if ('error' in device) return device.error

    // Omitted entirely when neither flag is given, so the org defaults apply.
    const region = values.region as string | undefined
    const config =
      device.device || region ? { device: device.device, region } : undefined

    return runPageCreateCommand(
      token,
      { url, name: values.name as string | undefined, config },
      { json: values.json === true }
    )
  }
}

const pageArchive: Command = {
  noun: 'page',
  verb: 'archive',
  summary: 'Archive a tracked page',
  options: {
    ...TOKEN_OPTION,
    ref: { type: 'string' },
    json: { type: 'boolean' }
  },
  help: [
    'Usage: xcelera page archive --ref <ref> [options]',
    '',
    'Archives a page so it is no longer audited or listed.',
    '',
    'Options:',
    '  --ref <ref>          The reference of the page. Required.',
    '  --token <token>      The xcelera API token.',
    '                       Can also be set with XCELERA_TOKEN.',
    '  --json               Print the raw API response.',
    '',
    'Examples:',
    '  xcelera page archive --ref example-page-xdfd'
  ],
  run: async (values, token) => {
    const ref = values.ref as string | undefined
    if (!ref) {
      return failure([
        'Page ref is required. Use --ref <ref> to specify the page to archive.',
        'Run `xcelera page list` to see the refs you have.'
      ])
    }

    return runPageArchiveCommand(token, ref, { json: values.json === true })
  }
}

const COMMANDS: Command[] = [
  auditRun,
  auditGet,
  pageList,
  pageCreate,
  pageArchive
]

/**
 * Parses argv and runs the matching command. Returns a CommandResult for every
 * outcome — including usage errors — so the entry point only prints and exits.
 */
export async function dispatch(argv: string[]): Promise<CommandResult> {
  const words = argv.slice(0, findFirstFlag(argv))
  const flags = argv.slice(words.length)

  if (words[0] === 'help' || words.length === 0) {
    return helpFor(words.slice(1))
  }

  if (flags.includes('--help') || flags.includes('-h')) {
    return helpFor(words)
  }

  const command = findCommand(words)
  if (!command) return unknownCommand(words)

  let values: OptionValues
  try {
    values = parseArgs({
      options: command.options,
      allowPositionals: false,
      args: flags
    }).values as OptionValues
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return failure([message, '', ...command.help])
  }

  const token =
    (values.token as string | undefined) ?? process.env.XCELERA_TOKEN
  if (!token) {
    return failure([
      'A token is required. Use --token or set the XCELERA_TOKEN environment variable.'
    ])
  }

  return command.run(values, token)
}

function findCommand(words: string[]): Command | undefined {
  if (words.length > 2) return undefined
  const [noun, verb = DEFAULT_VERBS[words[0]]] = words
  return COMMANDS.find((c) => c.noun === noun && c.verb === verb)
}

// Command words come first; everything from the first flag onward is options.
function findFirstFlag(argv: string[]): number {
  const index = argv.findIndex((arg) => arg.startsWith('-'))
  return index === -1 ? argv.length : index
}

function helpFor(words: string[]): CommandResult {
  if (words.length === 0) {
    return { exitCode: 0, output: overviewHelp(), errors: [] }
  }

  const command = findCommand(words)
  if (!command) return unknownCommand(words)

  return { exitCode: 0, output: command.help, errors: [] }
}

function overviewHelp(): string[] {
  return [
    'Usage: xcelera <noun> <verb> [options]',
    '',
    'Commands:',
    ...COMMANDS.map(
      (c) => `  ${`${c.noun} ${c.verb}`.padEnd(20)} ${c.summary}`
    ),
    '',
    'Run `xcelera help <noun> <verb>` for the options of one command.',
    '',
    'Environment:',
    '  XCELERA_TOKEN        API token, if --token is not given.',
    '  XCELERA_API_URL      API base URL (default https://xcelera.dev).'
  ]
}

function unknownCommand(words: string[]): CommandResult {
  return failure([
    `Unknown command: "${words.join(' ')}".`,
    '',
    ...overviewHelp()
  ])
}

function missingRef(): CommandResult {
  return failure([
    'Page ref is required. Use --ref <ref> to specify the page to audit.',
    'You can find the ref on the page in the xcelera dashboard.'
  ])
}

function parseTimeout(
  raw: string | undefined
): { seconds: number } | { error: CommandResult } {
  if (raw === undefined) return { seconds: DEFAULT_WAIT_TIMEOUT_SECONDS }

  const seconds = Number(raw)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return {
      error: failure([
        `--timeout must be a positive number of seconds, got "${raw}".`
      ])
    }
  }
  return { seconds }
}

function parseDevice(
  raw: string | undefined
): { device?: 'mobile' | 'desktop' } | { error: CommandResult } {
  if (raw === undefined) return {}
  if (raw !== 'mobile' && raw !== 'desktop') {
    return {
      error: failure([`--device must be "mobile" or "desktop", got "${raw}".`])
    }
  }
  return { device: raw }
}

function failure(errors: string[]): CommandResult {
  return { exitCode: 1, output: [], errors }
}
