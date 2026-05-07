/**
 * Internal model used by the clity generator. The generated CLI consumes this
 * exact shape (serialised to `lib/operations.json`), so any change here is a
 * change to the agent-facing `describe` contract — see CONSTITUTION.md § 2.
 */

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'

export type ParamLocation = 'path' | 'query' | 'header'

export type SimpleType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'unknown'

export interface CliParam {
  /** OpenAPI parameter name as it appears on the wire */
  name: string
  /** Kebab-case CLI flag name (without `--` prefix) */
  flagName: string
  in: ParamLocation
  required: boolean
  type: SimpleType
  /** When `type === 'array'`, the type of array items */
  itemsType?: SimpleType
  description?: string
  default?: unknown
  enum?: unknown[]
  /** Original JSON Schema, included verbatim in `describe` output */
  schema?: unknown
}

export interface CliRequestBody {
  required: boolean
  contentType: string
  description?: string
  schema?: unknown
}

export interface CliResponseSpec {
  status: string
  description?: string
  contentType?: string
  schema?: unknown
}

export interface CliSecurityScheme {
  /** OpenAPI key for the security scheme */
  name: string
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect'
  /** For apiKey */
  in?: 'header' | 'query' | 'cookie'
  paramName?: string
  /** For http (e.g. 'bearer', 'basic') */
  scheme?: string
  bearerFormat?: string
  description?: string
}

export interface CliOperation {
  /** Stable, kebab-case subcommand name. Unique across the spec. */
  command: string
  operationId?: string
  method: HttpMethod
  path: string
  summary?: string
  description?: string
  tags: string[]
  params: CliParam[]
  requestBody?: CliRequestBody
  responses: CliResponseSpec[]
  /** Names of security schemes that apply to this operation. */
  security: string[]
}

export interface CliSpec {
  /** describe-output schema version. Bumps follow CONSTITUTION.md § 7. */
  describeVersion: 1
  /** The generated package's CLI name (`bin` key). */
  cliName: string
  /** The generated package's version. */
  cliVersion: string
  /** Human-readable title from `info.title` of the source spec. */
  title: string
  /** API version from `info.version` of the source spec. */
  apiVersion: string
  description?: string
  /** Default base URL — first server, with variables substituted at generate-time using their defaults. */
  baseUrl: string
  /** All declared servers. Useful for agents picking environments. */
  servers: string[]
  operations: CliOperation[]
  security: CliSecurityScheme[]
  generator: {
    name: 'clity'
    version: string
    specSource: string
  }
}

export interface GeneratorOptions {
  /** Path or URL to the OpenAPI spec */
  spec: string
  /** Output directory; will be created if missing */
  output: string
  /** Override generated package name (defaults to slugged info.title) */
  name?: string
  /** Override generated package description (defaults to info.description) */
  description?: string
  /** Override generated package version (defaults to info.version) */
  version?: string
  /** Bake a base-URL override into the generated CLI */
  baseUrl?: string
  /** Overwrite the output directory if it exists */
  force?: boolean
}

export interface EmittedFile {
  /** Relative path within the output directory */
  path: string
  content: string
  /** When true, the file is marked executable on POSIX (chmod 0o755). */
  executable?: boolean
}
