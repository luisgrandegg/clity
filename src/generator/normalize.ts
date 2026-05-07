import type {
  CliOperation,
  CliParam,
  CliRequestBody,
  CliResponseSpec,
  CliSecurityScheme,
  CliSpec,
  HttpMethod,
  ParamLocation,
  SimpleType,
} from '../types.js'
import { expandServerUrl, kebabCase } from '../utils.js'

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const

interface NormalizeInputs {
  doc: Record<string, unknown>
  cliName: string
  cliVersion: string
  description?: string
  baseUrlOverride?: string
  specSource: string
  generatorVersion: string
}

/**
 * Normalize a dereferenced OpenAPI document into a CliSpec. Pure function: same
 * input, same output (the implementation must not depend on Map iteration order
 * or any non-stable source).
 */
export function normalize(inputs: NormalizeInputs): CliSpec {
  const { doc } = inputs
  const info = (doc.info ?? {}) as Record<string, unknown>
  const servers = (doc.servers as Array<{ url: string; variables?: Record<string, { default?: string }> }> | undefined) ?? []
  const expandedServers = servers.map((s) => expandServerUrl(s.url, s.variables))
  const baseUrl = inputs.baseUrlOverride ?? expandedServers[0] ?? ''

  const securitySchemes = readSecuritySchemes(doc)

  const operations = collectOperations(doc)
  ensureUniqueCommands(operations)

  return {
    describeVersion: 1,
    cliName: inputs.cliName,
    cliVersion: inputs.cliVersion,
    title: typeof info.title === 'string' ? info.title : inputs.cliName,
    apiVersion: typeof info.version === 'string' ? info.version : '0.0.0',
    description: inputs.description ?? (typeof info.description === 'string' ? info.description : undefined),
    baseUrl,
    servers: expandedServers,
    operations,
    security: securitySchemes,
    generator: {
      name: 'clity',
      version: inputs.generatorVersion,
      specSource: inputs.specSource,
    },
  }
}

function collectOperations(doc: Record<string, unknown>): CliOperation[] {
  const out: CliOperation[] = []
  const paths = (doc.paths ?? {}) as Record<string, Record<string, unknown>>

  for (const path of Object.keys(paths).sort()) {
    const pathItem = paths[path] ?? {}
    const pathLevelParams = ((pathItem as { parameters?: unknown[] }).parameters ?? []) as Array<Record<string, unknown>>

    for (const method of HTTP_METHODS) {
      const op = (pathItem as Record<string, unknown>)[method] as Record<string, unknown> | undefined
      if (!op) continue

      const operationId = typeof op.operationId === 'string' ? op.operationId : undefined
      const command = deriveCommand(method, path, operationId)

      const opLevelParams = ((op.parameters ?? []) as Array<Record<string, unknown>>) ?? []
      const params = mergeParameters(pathLevelParams, opLevelParams).map(toCliParam)

      const requestBody = toCliRequestBody(op.requestBody as Record<string, unknown> | undefined)

      const responses = toCliResponses((op.responses ?? {}) as Record<string, unknown>)

      const security = ((op.security ?? doc.security ?? []) as Array<Record<string, string[]>>).flatMap((entry) =>
        Object.keys(entry)
      )

      const tags = ((op.tags ?? []) as unknown[]).filter((t): t is string => typeof t === 'string')

      out.push({
        command,
        operationId,
        method: method as HttpMethod,
        path,
        summary: typeof op.summary === 'string' ? op.summary : undefined,
        description: typeof op.description === 'string' ? op.description : undefined,
        tags,
        params,
        requestBody,
        responses,
        security: dedupe(security),
      })
    }
  }

  return out
}

function deriveCommand(method: string, path: string, operationId?: string): string {
  if (operationId) {
    const k = kebabCase(operationId)
    if (k) return k
  }
  const segments = path
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/[{}]/g, ''))
    .map(kebabCase)
    .filter(Boolean)
  return [method.toLowerCase(), ...segments].join('-')
}

function ensureUniqueCommands(ops: CliOperation[]): void {
  const seen = new Map<string, number>()
  for (const op of ops) {
    const n = seen.get(op.command) ?? 0
    if (n > 0) {
      op.command = `${op.command}-${n + 1}`
    }
    seen.set(op.command, n + 1)
  }
}

function mergeParameters(
  pathLevel: Array<Record<string, unknown>>,
  opLevel: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  // Per OAS, op-level params override path-level by (name, in).
  const key = (p: Record<string, unknown>): string => `${String(p.in)}::${String(p.name)}`
  const merged = new Map<string, Record<string, unknown>>()
  for (const p of pathLevel) merged.set(key(p), p)
  for (const p of opLevel) merged.set(key(p), p)
  return [...merged.values()]
}

function toCliParam(raw: Record<string, unknown>): CliParam {
  const schema = (raw.schema ?? {}) as Record<string, unknown>
  const inLoc = String(raw.in ?? '')
  if (inLoc !== 'path' && inLoc !== 'query' && inLoc !== 'header') {
    throw new Error(`Unsupported parameter location: ${inLoc} (only path, query, header are supported in v0.1)`)
  }
  const name = String(raw.name)
  const type = inferType(schema)
  return {
    name,
    flagName: kebabCase(name),
    in: inLoc as ParamLocation,
    required: Boolean(raw.required) || inLoc === 'path',
    type,
    itemsType: type === 'array' ? inferType((schema.items ?? {}) as Record<string, unknown>) : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    default: schema.default,
    enum: Array.isArray(schema.enum) ? schema.enum : undefined,
    schema: raw.schema,
  }
}

function inferType(schema: Record<string, unknown> | undefined): SimpleType {
  if (!schema) return 'unknown'
  let t: unknown = schema.type
  if (Array.isArray(t)) {
    t = t.find((v) => v !== 'null') ?? 'unknown'
  }
  switch (t) {
    case 'string':
    case 'number':
    case 'integer':
    case 'boolean':
    case 'array':
    case 'object':
      return t
    default:
      return 'unknown'
  }
}

function toCliRequestBody(raw: Record<string, unknown> | undefined): CliRequestBody | undefined {
  if (!raw) return undefined
  const content = (raw.content ?? {}) as Record<string, { schema?: unknown }>
  // Prefer JSON
  const jsonKey = Object.keys(content).find((k) => /json/i.test(k))
  const chosenKey = jsonKey ?? Object.keys(content)[0]
  if (!chosenKey) return undefined
  return {
    required: Boolean(raw.required),
    contentType: chosenKey,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    schema: content[chosenKey]?.schema,
  }
}

function toCliResponses(raw: Record<string, unknown>): CliResponseSpec[] {
  const out: CliResponseSpec[] = []
  for (const status of Object.keys(raw).sort()) {
    const r = (raw[status] ?? {}) as Record<string, unknown>
    const content = (r.content ?? {}) as Record<string, { schema?: unknown }>
    const jsonKey = Object.keys(content).find((k) => /json/i.test(k)) ?? Object.keys(content)[0]
    out.push({
      status,
      description: typeof r.description === 'string' ? r.description : undefined,
      contentType: jsonKey,
      schema: jsonKey ? content[jsonKey]?.schema : undefined,
    })
  }
  return out
}

function readSecuritySchemes(doc: Record<string, unknown>): CliSecurityScheme[] {
  const components = (doc.components ?? {}) as Record<string, unknown>
  const schemes = (components.securitySchemes ?? {}) as Record<string, Record<string, unknown>>
  const out: CliSecurityScheme[] = []
  for (const name of Object.keys(schemes).sort()) {
    const s = schemes[name] ?? {}
    const type = String(s.type ?? '')
    if (type !== 'apiKey' && type !== 'http' && type !== 'oauth2' && type !== 'openIdConnect') continue
    const inLoc = typeof s.in === 'string' && (s.in === 'header' || s.in === 'query' || s.in === 'cookie') ? s.in : undefined
    out.push({
      name,
      type,
      in: inLoc,
      paramName: typeof s.name === 'string' ? s.name : undefined,
      scheme: typeof s.scheme === 'string' ? s.scheme : undefined,
      bearerFormat: typeof s.bearerFormat === 'string' ? s.bearerFormat : undefined,
      description: typeof s.description === 'string' ? s.description : undefined,
    })
  }
  return out
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}
