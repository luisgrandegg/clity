import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

import { generate } from '../src/cli.js'
import { CIRCULAR_REF_KEY } from '../src/generator/cycles.js'

/**
 * F-008 end-to-end: a spec with recursive schemas must generate a CLI whose
 * describe output is valid JSON, with each cycle replaced by a JSON Pointer
 * that resolves against the describe document itself.
 */

const FIXTURE = resolve(process.cwd(), 'test/fixtures/recursive-api.json')

function withTmp<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'clity-recursive-'))
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true })) as Promise<T>
}

function resolvePointer(doc: unknown, pointer: string): unknown {
  if (pointer === '#') return doc
  let node: unknown = doc
  for (const rawToken of pointer.replace(/^#\//, '').split('/')) {
    const token = rawToken.replace(/~1/g, '/').replace(/~0/g, '~')
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[token]
  }
  return node
}

function markers(doc: unknown, found: string[] = []): string[] {
  if (doc === null || typeof doc !== 'object') return found
  const asRecord = doc as Record<string, unknown>
  if (!Array.isArray(doc) && typeof asRecord[CIRCULAR_REF_KEY] === 'string') {
    found.push(asRecord[CIRCULAR_REF_KEY] as string)
    return found
  }
  for (const v of Object.values(asRecord)) markers(v, found)
  return found
}

async function generateRecursiveCli(dir: string): Promise<string> {
  const out = join(dir, 'gen')
  await generate({ spec: FIXTURE, output: out, name: 'recursive', version: '1.0.0' })
  return out
}

test('a spec with recursive schemas generates successfully', async () => {
  await withTmp(async (dir) => {
    const out = await generateRecursiveCli(dir)
    const raw = readFileSync(join(out, 'lib/operations.json'), 'utf8')

    // The whole point: this used to throw "Converting circular structure to JSON".
    const spec = JSON.parse(raw) as { operations: Array<{ command: string }> }
    assert.equal(spec.operations.length, 2)
    assert.ok(spec.operations.find((o) => o.command === 'get-tree'))
    assert.ok(spec.operations.find((o) => o.command === 'create-thread'))
  })
})

test('every cycle marker resolves against the describe document', async () => {
  await withTmp(async (dir) => {
    const out = await generateRecursiveCli(dir)
    const spec = JSON.parse(readFileSync(join(out, 'lib/operations.json'), 'utf8'))

    const found = markers(spec)
    assert.ok(found.length > 0, 'expected at least one cycle marker')
    for (const pointer of found) {
      assert.notEqual(
        resolvePointer(spec, pointer),
        undefined,
        `cycle marker ${pointer} does not resolve`
      )
    }
  })
})

test('a direct self-reference points at the enclosing schema', async () => {
  await withTmp(async (dir) => {
    const out = await generateRecursiveCli(dir)
    const spec = JSON.parse(readFileSync(join(out, 'lib/operations.json'), 'utf8')) as {
      operations: Array<{
        command: string
        responses: Array<{ schema?: Record<string, unknown> }>
      }>
    }

    const getTree = spec.operations.find((o) => o.command === 'get-tree')
    assert.ok(getTree)
    const schema = getTree.responses[0]?.schema
    assert.ok(schema)

    const properties = schema.properties as Record<string, Record<string, unknown>>
    const items = properties.children?.items as Record<string, string>
    assert.equal(typeof items[CIRCULAR_REF_KEY], 'string')

    // The marker resolves back to the schema that contains it.
    assert.equal(resolvePointer(spec, items[CIRCULAR_REF_KEY] as string), schema)
  })
})

test('the generated CLI runs describe on a recursive spec', async () => {
  await withTmp(async (dir) => {
    const out = await generateRecursiveCli(dir)
    const nodeModules = resolve(process.cwd(), 'node_modules')

    const all = spawnSync(process.execPath, [join(out, 'bin/cli.js'), 'describe'], {
      env: { ...process.env, NODE_PATH: nodeModules },
      encoding: 'utf8',
    })
    assert.equal(all.status, 0, `describe exited ${all.status}; stderr=${all.stderr}`)
    assert.equal((JSON.parse(all.stdout) as { operations: unknown[] }).operations.length, 2)

    const one = spawnSync(process.execPath, [join(out, 'bin/cli.js'), 'describe', 'get-tree'], {
      env: { ...process.env, NODE_PATH: nodeModules },
      encoding: 'utf8',
    })
    assert.equal(one.status, 0, `describe get-tree exited ${one.status}; stderr=${one.stderr}`)
    assert.equal((JSON.parse(one.stdout) as { command: string }).command, 'get-tree')
  })
})
