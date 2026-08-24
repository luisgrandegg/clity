import { Command } from 'commander'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { emit } from './generator/emit.js'
import { normalize } from './generator/normalize.js'
import { parseSpec } from './generator/parse.js'
import type { GeneratorOptions } from './types.js'
import { kebabCase } from './utils.js'

const here = dirname(fileURLToPath(import.meta.url))

/** Read the generator's own version from package.json. */
function generatorVersion(): string {
  const candidates = [
    resolve(here, '..', 'package.json'),
    resolve(here, '..', '..', 'package.json'),
  ]
  for (const c of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(c, 'utf8')) as { version?: string }
      if (pkg.version) return pkg.version
    } catch {
      continue
    }
  }
  return '0.0.0'
}

/**
 * Which pipeline stage an error came from. Surfaces as the `error` field of the
 * generator's stderr JSON, so a failure to serialise the spec is not reported
 * as a spec parse failure.
 */
export type GeneratorStage = 'parse' | 'normalize' | 'emit' | 'write'

interface StagedError extends Error {
  stage?: GeneratorStage
}

/** Run `fn`, tagging anything it throws with the stage it failed in. */
async function inStage<T>(stage: GeneratorStage, fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const e: StagedError = err instanceof Error ? err : new Error(String(err))
    e.stage ??= stage
    throw e
  }
}

/** Generator entrypoint. Returns the generated package directory on success. */
export async function generate(opts: GeneratorOptions): Promise<string> {
  const outputDir = resolve(process.cwd(), opts.output)
  ensureOutputDir(outputDir, Boolean(opts.force))

  const doc = await inStage('parse', () => parseSpec(opts.spec))

  const info = ((doc.info as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
  const cliName = opts.name ?? deriveCliName(typeof info.title === 'string' ? info.title : 'api') ?? 'api-cli'
  const cliVersion = opts.version ?? (typeof info.version === 'string' ? info.version : '0.1.0')

  const spec = await inStage('normalize', () => normalize({
    doc,
    cliName,
    cliVersion,
    description: opts.description,
    baseUrlOverride: opts.baseUrl,
    specSource: opts.spec,
    generatorVersion: generatorVersion(),
  }))

  const files = await inStage('emit', () => emit(spec))
  await inStage('write', () => {
    for (const f of files) {
      const abs = join(outputDir, f.path)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, f.content)
      if (f.executable && process.platform !== 'win32') {
        chmodSync(abs, 0o755)
      }
    }
  })

  return outputDir
}

function ensureOutputDir(dir: string, force: boolean): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    return
  }
  const st = statSync(dir)
  if (!st.isDirectory()) {
    throw new Error(`Output path exists and is not a directory: ${dir}`)
  }
  const entries = readdirSync(dir)
  if (entries.length === 0) return
  if (!force) {
    throw new Error(`Output directory is not empty: ${dir}\nPass --force to overwrite.`)
  }
  for (const e of entries) rmSync(join(dir, e), { recursive: true, force: true })
}

function deriveCliName(title: string): string {
  return kebabCase(title)
}

function writeError(obj: Record<string, unknown>): void {
  process.stderr.write(JSON.stringify(obj) + '\n')
}

/** CLI entrypoint. Called by bin/clity.mjs. */
export async function main(argv: string[]): Promise<void> {
  const program = new Command()
  program
    .name('clity')
    .description('Generate an agent-ready CLI from an OpenAPI spec')
    .version(generatorVersion(), '-V, --version')
    .argument('<spec>', 'OpenAPI spec — URL or local file path')
    .requiredOption('--output <dir>', 'Output directory for the generated package')
    .option('--name <name>', 'Override the generated CLI name')
    .option('--description <text>', 'Override the generated package description')
    .option('--package-version <semver>', 'Set the generated package version (defaults to spec info.version)')
    .option('--base-url <url>', 'Bake a base-URL override into the generated CLI')
    .option('--force', 'Overwrite the output directory if it exists', false)

  program.exitOverride((err) => {
    if (
      err.code === 'commander.help' ||
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.version'
    ) {
      process.exit(0)
    }
    writeError({ error: 'usage', message: err.message })
    process.exit(1)
  })

  program.action(async (spec: string, opts: Record<string, unknown>) => {
    try {
      const outDir = await generate({
        spec,
        output: String(opts.output),
        name: typeof opts.name === 'string' ? opts.name : undefined,
        description: typeof opts.description === 'string' ? opts.description : undefined,
        version: typeof opts.packageVersion === 'string' ? opts.packageVersion : undefined,
        baseUrl: typeof opts.baseUrl === 'string' ? opts.baseUrl : undefined,
        force: Boolean(opts.force),
      })
      process.stdout.write(JSON.stringify({ ok: true, output: outDir }) + '\n')
      process.exit(0)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Network errors talking to a remote spec → exit 4 per the documented map.
      const isNetwork = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|fetch failed/i.test(message)
      const stage = (err as StagedError | undefined)?.stage
      writeError({ error: isNetwork ? 'network' : (stage ?? 'parse'), message })
      process.exit(isNetwork ? 4 : 1)
    }
  })

  await program.parseAsync(['node', 'clity', ...argv])
}
