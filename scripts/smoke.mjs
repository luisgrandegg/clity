#!/usr/bin/env node
// Cross-platform smoke test. Builds clity, generates the petstore CLI, runs
// `describe`, and prints the operation count. Replaces a shell pipe through
// jq so the script works under Windows cmd.exe (single quotes are not stripped
// there, which broke `jq '.operations | length'`).
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

// Invoke tsc directly via Node so we don't have to spawn the pnpm.cmd shim
// (which requires `shell: true` on Windows post-CVE-2024-27980 and triggers a
// DEP0190 deprecation warning).
run(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc')])
run(process.execPath, [
  'bin/clity.mjs',
  './test/fixtures/petstore.json',
  '--output',
  './test/.tmp/petstore-cli',
  '--force',
])

const describe = spawnSync(
  process.execPath,
  ['./test/.tmp/petstore-cli/bin/cli.js', 'describe'],
  { cwd: root, encoding: 'utf8' }
)
if (describe.status !== 0) {
  process.stderr.write(describe.stderr ?? '')
  process.exit(describe.status ?? 1)
}

const spec = JSON.parse(describe.stdout)
process.stdout.write(`${spec.operations.length}\n`)
