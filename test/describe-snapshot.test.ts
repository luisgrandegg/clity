import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { generate } from '../src/cli.js'

/**
 * Snapshot test for the describe / operations.json output of the generated
 * Petstore CLI. The shape of this document is the agent-facing contract — see
 * CONSTITUTION.md § 2 — so an accidental change must fail CI.
 *
 * Determinism: we pin every input that varies by environment.
 * - `name` and `version` are passed explicitly so they don't drift with
 *   package.json's version.
 * - `generator.specSource` echoes the absolute path the caller passed in, which
 *   is environment-dependent. We rewrite it to a stable string before
 *   comparison.
 * - `generator.version` is clity's own release version, which changes on every
 *   release and is not part of the describe contract. We pin it too, so a
 *   version bump does not masquerade as a contract change.
 *
 * To regenerate after an intentional change, run:
 *   UPDATE_SNAPSHOTS=1 pnpm test
 * (or `pnpm test:update`). Always read the diff before committing.
 */

const FIXTURE = resolve(process.cwd(), 'test/fixtures/petstore.json')
const SNAPSHOT_PATH = resolve(process.cwd(), 'test/__snapshots__/petstore-describe.json')
const STABLE_SPEC_SOURCE = 'test/fixtures/petstore.json'
const STABLE_GENERATOR_VERSION = '0.0.0-snapshot'

interface CliSpecLike {
  generator: { specSource: string; version: string; [k: string]: unknown }
  [k: string]: unknown
}

function withTmp<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'clity-snapshot-'))
  return Promise.resolve(fn(dir)).finally(() =>
    rmSync(dir, { recursive: true, force: true })
  ) as Promise<T>
}

async function generatePetstoreSpec(): Promise<CliSpecLike> {
  return withTmp(async (dir) => {
    const out = join(dir, 'gen')
    await generate({ spec: FIXTURE, output: out, name: 'petstore', version: '0.1.0' })
    const spec = JSON.parse(readFileSync(join(out, 'lib/operations.json'), 'utf8')) as CliSpecLike
    // Stabilise the fields that vary by environment or release. Everything else
    // is fully determined by the fixture + the explicit name/version above.
    spec.generator.specSource = STABLE_SPEC_SOURCE
    spec.generator.version = STABLE_GENERATOR_VERSION
    return spec
  })
}

function serialise(spec: CliSpecLike): string {
  return JSON.stringify(spec, null, 2) + '\n'
}

test('describe output matches the petstore snapshot', async () => {
  const spec = await generatePetstoreSpec()
  const actual = serialise(spec)

  if (process.env.UPDATE_SNAPSHOTS === '1') {
    mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true })
    writeFileSync(SNAPSHOT_PATH, actual)
    return
  }

  assert.ok(
    existsSync(SNAPSHOT_PATH),
    `Snapshot missing at ${SNAPSHOT_PATH}. Run \`UPDATE_SNAPSHOTS=1 pnpm test\` (or \`pnpm test:update\`) to create it.`
  )

  const expected = readFileSync(SNAPSHOT_PATH, 'utf8')
  if (actual !== expected) {
    assert.fail(
      `describe output differs from snapshot at ${SNAPSHOT_PATH}.\n` +
        `If this change is intentional, regenerate with \`UPDATE_SNAPSHOTS=1 pnpm test\` (or \`pnpm test:update\`) and review the diff.\n` +
        `Note: a change in the describe shape is a contract change — see CONSTITUTION.md § 2.`
    )
  }
})
