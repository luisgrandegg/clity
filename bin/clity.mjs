#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const distEntry = resolve(here, '..', 'dist', 'src', 'cli.js')
const distEntryFlat = resolve(here, '..', 'dist', 'cli.js')

const target = existsSync(distEntry) ? distEntry : distEntryFlat
if (!existsSync(target)) {
  process.stderr.write(
    JSON.stringify({
      error: 'not_built',
      message:
        'clity has not been built yet. Run `pnpm build` (or `npm run build`) in the clity repo first, then re-run.',
    }) + '\n'
  )
  process.exit(1)
}

const mod = await import(target)
await mod.main(process.argv.slice(2))
