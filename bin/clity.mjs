#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from 'node:url'
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

// Dynamic import() requires a file:// URL on Windows; an absolute path string
// is parsed as a URL with the drive letter as scheme (`c:`) and rejected.
const mod = await import(pathToFileURL(target).href)
await mod.main(process.argv.slice(2))
