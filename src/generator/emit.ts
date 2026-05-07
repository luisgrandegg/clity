import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { CliSpec, EmittedFile } from '../types.js'
import { agentsMd, operationsJson, packageJson, readme } from './templates.js'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Pure function: CliSpec → array of files to write. The runtime .js files are
 * read from disk (they live in src/generator/runtime/) and copied verbatim.
 * No templating is applied to them — the spec they need is loaded at runtime
 * from `lib/operations.json`.
 */
export function emit(spec: CliSpec): EmittedFile[] {
  const cliJs = readRuntimeFile('cli.js')
  const runtimeJs = readRuntimeFile('runtime.js')

  return [
    { path: 'package.json', content: packageJson(spec) },
    { path: 'README.md', content: readme(spec) },
    { path: 'AGENTS.md', content: agentsMd(spec) },
    { path: 'bin/cli.js', content: cliJs, executable: true },
    { path: 'lib/runtime.js', content: runtimeJs },
    { path: 'lib/operations.json', content: operationsJson(spec) },
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
