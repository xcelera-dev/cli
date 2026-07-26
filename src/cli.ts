#!/usr/bin/env node
/* istanbul ignore file */

import { dispatch } from './lib/dispatch.js'

const result = await dispatch(process.argv.slice(2))

result.output.forEach((line: string) => console.log(line))
result.errors.forEach((line: string) => console.error(line))
process.exit(result.exitCode)
