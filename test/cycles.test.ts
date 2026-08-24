import { test } from 'node:test'
import { strict as assert } from 'node:assert'

import { CIRCULAR_REF_KEY, MAX_EXPANDED_NODES, breakCycles } from '../src/generator/cycles.js'

/**
 * Resolve an RFC 6901 JSON Pointer against a document. The point of the cycle
 * marker is that an agent can do exactly this, so the tests resolve pointers
 * rather than string-matching them.
 */
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

/** Collect every `x-circular-ref` pointer in a document. */
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

test('breakCycles leaves an acyclic value untouched', () => {
  const input = { a: 1, b: ['x', { c: null }], d: 'e' }
  assert.deepEqual(breakCycles(input), input)
})

test('breakCycles replaces a direct self-reference with a pointer to the root', () => {
  const node: Record<string, unknown> = { type: 'object' }
  node.items = node

  const out = breakCycles(node)
  assert.deepEqual(markers(out), ['#'])
  assert.equal(resolvePointer(out, '#'), out)
})

test('breakCycles points at the exact ancestor the cycle closes on', () => {
  const inner: Record<string, unknown> = { name: 'Node' }
  inner.children = { items: inner }
  const spec = { operations: [{ schema: inner }] }

  const out = breakCycles(spec)
  assert.deepEqual(markers(out), ['#/operations/0/schema'])

  const target = resolvePointer(out, '#/operations/0/schema') as Record<string, unknown>
  assert.equal(target.name, 'Node')
})

test('breakCycles handles mutual recursion', () => {
  const comment: Record<string, unknown> = { kind: 'comment' }
  const author: Record<string, unknown> = { kind: 'author', latest: comment }
  comment.author = author

  const out = breakCycles({ root: comment })
  assert.deepEqual(markers(out), ['#/root'])

  const target = resolvePointer(out, '#/root') as Record<string, unknown>
  assert.equal(target.kind, 'comment')
})

test('breakCycles keeps a repeated subtree in full — a DAG is not a cycle', () => {
  const shared = { type: 'string', format: 'uuid' }
  const out = breakCycles({ a: shared, b: shared })

  // Both branches keep the whole schema; neither degrades into a marker.
  assert.deepEqual(out, { a: shared, b: shared })
  assert.deepEqual(markers(out), [])
})

test('breakCycles escapes JSON Pointer tokens in the emitted path', () => {
  const inner: Record<string, unknown> = {}
  inner.self = inner

  const out = breakCycles({ 'a/b': { 'c~d': inner } })
  assert.deepEqual(markers(out), ['#/a~1b/c~0d'])
  assert.ok(resolvePointer(out, '#/a~1b/c~0d') !== undefined)
})

test('breakCycles output is JSON-serialisable', () => {
  const node: Record<string, unknown> = { name: 'Node' }
  node.child = node
  assert.doesNotThrow(() => JSON.stringify(breakCycles(node)))
})

test('breakCycles rejects a document that expands past the node budget', () => {
  // A shallow but wide DAG: each level multiplies the expanded node count.
  let level: unknown = { leaf: true }
  for (let i = 0; i < 12; i++) level = { a: level, b: level, c: level }

  assert.throws(() => breakCycles(level, 1000), /too large to embed/)
})

test('the node budget is generous enough for a large real spec', () => {
  // GitHub's REST API — the largest spec we generate — expands to ~570k nodes.
  assert.ok(MAX_EXPANDED_NODES >= 5_000_000)
})
