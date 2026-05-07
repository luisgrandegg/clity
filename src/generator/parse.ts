import OpenAPIParser from '@readme/openapi-parser'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Load + dereference an OpenAPI spec from a URL or local path. Returns the
 * fully-dereferenced document (no `$ref`s remain). Throws on parse / validation
 * errors with a message suitable for the generator's stderr.
 */
export async function parseSpec(specSource: string): Promise<Record<string, unknown>> {
  const isUrl = /^https?:\/\//i.test(specSource)
  let input: string | Record<string, unknown>

  if (isUrl) {
    input = specSource
  } else {
    const path = resolve(process.cwd(), specSource)
    if (!existsSync(path)) {
      throw new Error(`Spec file not found: ${path}`)
    }
    const raw = readFileSync(path, 'utf8')
    try {
      input = JSON.parse(raw) as Record<string, unknown>
    } catch {
      input = path
    }
  }

  const api = await OpenAPIParser.dereference(input as never)
  return api as unknown as Record<string, unknown>
}
