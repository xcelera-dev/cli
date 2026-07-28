#!/usr/bin/env node
/* istanbul ignore file */

import { dispatch } from './lib/dispatch.js'
import { createConsoleProgress } from './lib/progress.js'

const progress = createConsoleProgress(process.stdout, process.stderr)
const result = await dispatch(process.argv.slice(2), { progress })
progress.finish()

// `output` was already streamed line by line; only the errors are left.
result.errors.forEach((line: string) => console.error(line))
process.exit(result.exitCode)
