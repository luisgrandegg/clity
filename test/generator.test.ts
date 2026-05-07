import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

import { generate } from '../src/cli.js'

const FIXTURE = resolve(process.cwd(), 'test/fixtures/petstore.json')

function withTmp<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'clity-test-'))
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true })) as Promise<T>
}

test('generate writes the expected file set', async () => {
  await withTmp(async (dir) => {
    const out = join(dir, 'gen')
    await generate({ spec: FIXTURE, output: out })

    const expected = ['package.json', 'README.md', 'AGENTS.md', 'bin/cli.js', 'lib/runtime.js', 'lib/operations.json', '.gitignore']
    for (const f of expected) {
      assert.ok(existsSync(join(out, f)), `expected file missing: ${f}`)
    }
  })
})

test('generated package.json is well-formed and lists exactly one runtime dep', async () => {
  await withTmp(async (dir) => {
    const out = join(dir, 'gen')
    await generate({ spec: FIXTURE, output: out, name: 'petstore', version: '9.9.9' })

    const pkg = JSON.parse(readFileSync(join(out, 'package.json'), 'utf8')) as {
      name: string
      version: string
      bin: Record<string, string>
      dependencies: Record<string, string>
    }
    assert.equal(pkg.name, 'petstore')
    assert.equal(pkg.version, '9.9.9')
    assert.equal(pkg.bin.petstore, 'bin/cli.js')
    assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['commander'])
  })
})

test('operations.json contains the embedded CliSpec with operations', async () => {
  await withTmp(async (dir) => {
    const out = join(dir, 'gen')
    await generate({ spec: FIXTURE, output: out, name: 'petstore', version: '0.1.0' })

    const spec = JSON.parse(readFileSync(join(out, 'lib/operations.json'), 'utf8')) as {
      describeVersion: number
      cliName: string
      operations: Array<{ command: string }>
    }
    assert.equal(spec.describeVersion, 1)
    assert.equal(spec.cliName, 'petstore')
    assert.ok(spec.operations.length >= 8, `expected at least 8 operations, got ${spec.operations.length}`)
    assert.ok(spec.operations.find((o) => o.command === 'get-pet-by-id'))
  })
})

test('generated bin/cli.js produces valid describe JSON when run', async () => {
  await withTmp(async (dir) => {
    const out = join(dir, 'gen')
    await generate({ spec: FIXTURE, output: out, name: 'petstore', version: '0.1.0' })

    // commander is a dep of the parent project, so symlink it into the generated package
    // to avoid a network install during the test.
    const nodeModules = resolve(process.cwd(), 'node_modules')
    const result = spawnSync(process.execPath, [join(out, 'bin/cli.js'), 'describe'], {
      env: { ...process.env, NODE_PATH: nodeModules },
      encoding: 'utf8',
    })
    assert.equal(result.status, 0, `describe exited ${result.status}; stderr=${result.stderr}`)
    const parsed = JSON.parse(result.stdout) as { operations: Array<{ command: string }> }
    assert.ok(parsed.operations.length > 0)
  })
})

test('generated CLI exits 1 with usage error when required flag is missing', async () => {
  await withTmp(async (dir) => {
    const out = join(dir, 'gen')
    await generate({ spec: FIXTURE, output: out, name: 'petstore', version: '0.1.0' })

    const nodeModules = resolve(process.cwd(), 'node_modules')
    const result = spawnSync(process.execPath, [join(out, 'bin/cli.js'), 'get-pet-by-id'], {
      env: { ...process.env, NODE_PATH: nodeModules },
      encoding: 'utf8',
    })
    assert.equal(result.status, 1)
    const err = JSON.parse(result.stderr) as { error: string }
    assert.equal(err.error, 'usage')
  })
})

test('--force overwrites a non-empty output directory', async () => {
  await withTmp(async (dir) => {
    const out = join(dir, 'gen')
    await generate({ spec: FIXTURE, output: out })
    await assert.rejects(() => generate({ spec: FIXTURE, output: out }), /not empty/)
    await generate({ spec: FIXTURE, output: out, force: true })
  })
})
