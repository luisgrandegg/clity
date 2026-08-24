import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { CliSpec, EmittedFile } from '../types.js'
import { breakCycles } from './cycles.js'
import { agentsMd, operationsJson, packageJson, readme } from './templates.js'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Pure function: CliSpec → array of files to write. The runtime .js files are
 * read from disk (they live in src/generator/runtime/) and copied verbatim.
 * No templating is applied to them — the spec they need is loaded at runtime
 * from `lib/operations.json`.
 *
 * Cycles are broken up-front so every template sees a serialisable spec — a
 * dereferenced recursive schema is a circular object and would otherwise throw
 * in `JSON.stringify`. See ./cycles.ts.
 */
export function emit(spec: CliSpec): EmittedFile[] {
  const cliJs = readRuntimeFile('cli.js')
  const runtimeJs = readRuntimeFile('runtime.js')
  const acyclic = breakCycles(spec)

  return [
    { path: 'package.json', content: packageJson(acyclic) },
    { path: 'README.md', content: readme(acyclic) },
    { path: 'AGENTS.md', content: agentsMd(acyclic) },
    { path: 'bin/cli.js', content: cliJs, executable: true },
    { path: 'lib/runtime.js', content: runtimeJs },
    { path: 'lib/operations.json', content: operationsJson(acyclic) },
    { path: '.gitignore', content: 'node_modules\n' },
  ]
}

function readRuntimeFile(name: string): string {
  // After tsc: dist/generator/emit.js → ../../src/generator/runtime/<name>
  // From source via tsx:                  ./runtime/<name>
  const candidates = [
    resolve(here, 'runtime', name),
    resolve(here, '..', '..', 'src', 'generator', 'runtime', name),
    resolve(here, '..', '..', '..', 'src', 'generator', 'runtime', name),
  ]
  for (const c of candidates) {
    try {
      return readFileSync(c, 'utf8')
    } catch {
      continue
    }
  }
  throw new Error(`clity: could not locate runtime file ${name}. Looked in:\n  ${candidates.join('\n  ')}`)
}
