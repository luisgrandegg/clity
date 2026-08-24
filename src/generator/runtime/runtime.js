/**
 * clity-generated runtime. Plain JavaScript, native fetch, no runtime deps
 * other than commander (which is consumed by cli.js, not here). Forkable by
 * design — see CONSTITUTION.md § 3 and § 6 in the clity repo.
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const EXIT = Object.freeze({
  OK: 0,
  USAGE: 1,
  API_4XX: 2,
  API_5XX: 3,
  NETWORK: 4,
})

function envPrefix(cliName) {
  return String(cliName).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()
}

function configPath(cliName) {
  return path.join(os.homedir(), `.${cliName}`, 'config.json')
}

function readConfig(cliName) {
  try {
    const raw = fs.readFileSync(configPath(cliName), 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeConfig(cliName, cfg) {
  const file = configPath(cliName)
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 })
  return file
}

function resolveAuth(spec, globalOpts) {
  const cfg = readConfig(spec.cliName)
  const prefix = envPrefix(spec.cliName)
  const token = globalOpts.token || process.env[prefix + '_TOKEN'] || cfg.token
  const apiKey = globalOpts.apiKey || process.env[prefix + '_API_KEY'] || cfg.apiKey
  return { token, apiKey }
}

function camelCase(s) {
  return String(s).replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}

function usageError(message) {
  const err = new Error(message)
  err._usage = true
  return err
}

function writeOut(value, pretty) {
  const out = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)
  process.stdout.write(out + '\n')
}

function writeError(obj) {
  process.stderr.write(JSON.stringify(obj) + '\n')
}

function buildUrl(baseUrl, op, opts) {
  if (!baseUrl) {
    throw usageError('No base URL configured. Pass --base-url or define a server in the spec.')
  }
  let urlPath = op.path
  for (const p of op.params) {
    if (p.in !== 'path') continue
    const v = opts[camelCase(p.flagName)]
    if (v === undefined) {
      throw usageError(`Missing required path parameter: --${p.flagName}`)
    }
    urlPath = urlPath.replace(`{${p.name}}`, encodeURIComponent(String(v)))
  }
  const u = new URL(baseUrl.replace(/\/$/, '') + urlPath)
  for (const p of op.params) {
    if (p.in !== 'query') continue
    const v = opts[camelCase(p.flagName)]
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) {
      for (const item of v) u.searchParams.append(p.name, String(item))
    } else {
      u.searchParams.append(p.name, String(v))
    }
  }
  return u.toString()
}

function buildHeaders(spec, op, opts, auth) {
  const headers = { Accept: 'application/json' }
  for (const p of op.params) {
    if (p.in !== 'header') continue
    const v = opts[camelCase(p.flagName)]
    if (v !== undefined && v !== null) headers[p.name] = String(v)
  }
  applyAuth(headers, spec, op, auth)
  return headers
}

function applyAuth(headers, spec, op, auth) {
  const opSecurityNames = (op.security && op.security.length ? op.security : []).slice()
  let applied = false

  for (const name of opSecurityNames) {
    const scheme = (spec.security || []).find((s) => s.name === name)
    if (!scheme) continue
    if (scheme.type === 'http' && /^bearer$/i.test(scheme.scheme || '') && auth.token) {
      headers['Authorization'] = `Bearer ${auth.token}`
      applied = true
    } else if (scheme.type === 'apiKey' && scheme.in === 'header' && scheme.paramName && (auth.apiKey || auth.token)) {
      headers[scheme.paramName] = auth.apiKey || auth.token
      applied = true
    }
  }

  // Fallback: if a token was provided but no scheme matched (or no security on
  // this op), set Authorization. Many specs omit per-op security.
  if (!applied && auth.token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${auth.token}`
  }
}

function readBodyArg(opts) {
  if (opts.body !== undefined) {
    try {
      return JSON.parse(opts.body)
    } catch (e) {
      throw usageError(`Invalid JSON in --body: ${e.message}`)
    }
  }
  if (opts.bodyFile) {
    let raw
    try {
      raw = fs.readFileSync(opts.bodyFile, 'utf8')
    } catch (e) {
      throw usageError(`Cannot read --body-file: ${e.message}`)
    }
    try {
      return JSON.parse(raw)
    } catch (e) {
      throw usageError(`Invalid JSON in --body-file (${opts.bodyFile}): ${e.message}`)
    }
  }
  return undefined
}

async function runOperation(spec, op, opts, globalOpts) {
  const baseUrl = globalOpts.baseUrl || spec.baseUrl
  const auth = resolveAuth(spec, globalOpts)
  const url = buildUrl(baseUrl, op, opts)
  const headers = buildHeaders(spec, op, opts, auth)

  let body
  if (op.requestBody) {
    body = readBodyArg(opts)
    if (op.requestBody.required && body === undefined) {
      throw usageError(`Operation "${op.command}" requires a request body. Use --body or --body-file.`)
    }
    if (body !== undefined) {
      headers['Content-Type'] = op.requestBody.contentType || 'application/json'
    }
  }

  let res
  try {
    res = await fetch(url, {
      method: op.method.toUpperCase(),
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    writeError({ error: 'network', message: e.message, url })
    process.exit(EXIT.NETWORK)
  }

  const text = await res.text()
  let parsed = null
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (res.ok) {
    if (parsed === null) {
      writeOut({ status: res.status }, globalOpts.pretty)
    } else {
      writeOut(parsed, globalOpts.pretty)
    }
    process.exit(EXIT.OK)
  }

  writeError({
    error: 'http',
    status: res.status,
    statusText: res.statusText,
    url,
    body: parsed,
  })
  process.exit(res.status >= 500 ? EXIT.API_5XX : EXIT.API_4XX)
}

function exitForError(err) {
  if (err && err._usage) {
    writeError({ error: 'usage', message: err.message })
    process.exit(EXIT.USAGE)
  }
  writeError({ error: 'internal', message: err && err.message ? err.message : String(err) })
  process.exit(EXIT.USAGE)
}

function runDescribe(spec) {
  process.stdout.write(JSON.stringify(spec) + '\n')
  process.exit(EXIT.OK)
}

function runDescribeOne(spec, commandName) {
  const op = (spec.operations || []).find((o) => o.command === commandName)
  if (!op) {
    writeError({ error: 'unknown_command', command: commandName })
    process.exit(EXIT.USAGE)
  }
  process.stdout.write(JSON.stringify(op) + '\n')
  process.exit(EXIT.OK)
}

// The root program declares --token/--api-key too, and Commander binds those
// flags to the root command even when they appear after `auth set`. So the
// subcommand's own options are always empty in practice; fall back to the
// root's values, preferring anything Commander did manage to bind locally.
function runAuthSet(spec, opts, globalOpts) {
  const root = globalOpts || {}
  const token = opts.token !== undefined ? opts.token : root.token
  const apiKey = opts.apiKey !== undefined ? opts.apiKey : root.apiKey
  if (token === undefined && apiKey === undefined) {
    writeError({ error: 'usage', message: 'auth set requires --token and/or --api-key' })
    process.exit(EXIT.USAGE)
  }
  const cfg = readConfig(spec.cliName)
  if (token !== undefined) cfg.token = token
  if (apiKey !== undefined) cfg.apiKey = apiKey
  const file = writeConfig(spec.cliName, cfg)
  writeOut({ ok: true, configFile: file, fields: Object.keys(cfg) })
  process.exit(EXIT.OK)
}

function runAuthShow(spec) {
  const cfg = readConfig(spec.cliName)
  writeOut({
    configFile: configPath(spec.cliName),
    hasToken: typeof cfg.token === 'string' && cfg.token.length > 0,
    hasApiKey: typeof cfg.apiKey === 'string' && cfg.apiKey.length > 0,
    envPrefix: envPrefix(spec.cliName),
  })
  process.exit(EXIT.OK)
}

module.exports = {
  EXIT,
  runOperation,
  runDescribe,
  runDescribeOne,
  runAuthSet,
  runAuthShow,
  exitForError,
  writeError,
  // exported for testing
  _internal: { camelCase, buildUrl, buildHeaders, applyAuth, envPrefix, configPath },
}
