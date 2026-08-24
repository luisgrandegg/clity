/**
 * Cycle handling for the emitted describe document.
 *
 * `parseSpec()` dereferences the spec, which inlines every `$ref`. A schema
 * that refers to itself — a tree node, a linked list, a comment thread — then
 * becomes a genuinely circular JavaScript object, and `JSON.stringify` throws
 * `TypeError: Converting circular structure to JSON`.
 *
 * We break each cycle by replacing the back-edge with a JSON Pointer
 * (RFC 6901) marker that an agent can resolve against the describe document
 * itself. No structural information is lost: the pointer names exactly which
 * ancestor the cycle closes on.
 *
 * Only *back-edges* are replaced — a reference to a node that is an ancestor
 * on the current walk path. A subtree that merely appears more than once in
 * different branches is a DAG, not a cycle, and is still emitted in full, so
 * this never changes output for a spec that already generated successfully.
 *
 * Breaking cycles does not bound the *size* of the result. Dereferencing also
 * inlines every shared (non-circular) schema at each of its use sites, and for
 * a heavily cross-referenced spec that expansion is combinatorial: Stripe's
 * spec reaches tens of millions of nodes from 589 operations, where GitHub's
 * 1221 operations expand to ~570k. We refuse those up-front with a clear error
 * rather than running the process out of memory. See backlog F-009.
 */

/** Marker key for a cycle back-edge. Its value is a JSON Pointer. */
export const CIRCULAR_REF_KEY = 'x-circular-ref'

/** A back-edge, as emitted in place of the circular reference. */
export interface CircularRef {
  [CIRCULAR_REF_KEY]: string
}

/**
 * Ceiling on the expanded node count of the describe document, chosen at ~10x
 * the largest spec we generate successfully (GitHub's REST API, ~570k nodes).
 */
export const MAX_EXPANDED_NODES = 5_000_000

/**
 * Deep-copy `value`, replacing every cycle back-edge with a `CircularRef`.
 * Deterministic: key order follows the input's own insertion order.
 *
 * Throws if the document would expand past `MAX_EXPANDED_NODES`. The size is
 * measured in a counting pre-pass that allocates nothing, so an oversized spec
 * is rejected without first building the copy that would exhaust memory.
 */
export function breakCycles<T>(value: T, maxNodes = MAX_EXPANDED_NODES): T {
  const expanded = countExpandedNodes(value, maxNodes)
  if (expanded === null) {
    throw new Error(
      `Spec is too large to embed: it expands to more than ${maxNodes.toLocaleString()} nodes.\n` +
        'Dereferencing inlines every shared schema at each use site, and for a heavily\n' +
        'cross-referenced spec that expansion is combinatorial. Generating a CLI for a\n' +
        'subset of the spec is the current workaround; deduplicating shared schemas is\n' +
        'tracked as backlog item F-009.'
    )
  }
  return copyBreakingCycles(value)
}

/**
 * Count the nodes `breakCycles` would emit, without allocating them. Returns
 * `null` as soon as the count exceeds `maxNodes`, so a pathological spec costs
 * a bounded walk rather than an unbounded one.
 */
function countExpandedNodes(value: unknown, maxNodes: number): number | null {
  const ancestors = new Set<object>()
  let count = 0

  function walk(node: unknown): boolean {
    count++
    if (count > maxNodes) return false
    if (node === null || typeof node !== 'object') return true
    // A back-edge is emitted as a single marker node; do not descend.
    if (ancestors.has(node)) return true

    ancestors.add(node)
    for (const v of Object.values(node as Record<string, unknown>)) {
      if (!walk(v)) return false
    }
    ancestors.delete(node)
    return true
  }

  return walk(value) ? count : null
}

function copyBreakingCycles<T>(value: T): T {
  // Ancestors on the current path only — added on enter, removed on exit.
  const ancestors = new Map<object, string>()

  function walk(node: unknown, pointer: string): unknown {
    if (node === null || typeof node !== 'object') return node

    const ancestorPointer = ancestors.get(node)
    if (ancestorPointer !== undefined) {
      return { [CIRCULAR_REF_KEY]: ancestorPointer } satisfies CircularRef
    }

    ancestors.set(node, pointer)
    let copy: unknown
    if (Array.isArray(node)) {
      copy = node.map((item, i) => walk(item, `${pointer}/${i}`))
    } else {
      const out: Record<string, unknown> = {}
      for (const [key, v] of Object.entries(node as Record<string, unknown>)) {
        out[key] = walk(v, `${pointer}/${escapeToken(key)}`)
      }
      copy = out
    }
    ancestors.delete(node)
    return copy
  }

  return walk(value, '#') as T
}

/** RFC 6901 §3: `~` → `~0`, `/` → `~1`. Order matters. */
function escapeToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1')
}
