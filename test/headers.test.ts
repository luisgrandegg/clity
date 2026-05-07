import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import { generate } from '../src/cli.js'

const FIXTURE = resolve(process.cwd(), 'test/fixtures/headers-api.json')

interface CapturedRequest {
  url: string | undefined
  method: string | undefined
  headers: Record<string, string | string[] | undefined>
}

function withTmp<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'clity-headers-'))
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true })) as Promise<T>
}

/**
 * Spin up an ephemeral HTTP server on 127.0.0.1 that records the headers of
 * every incoming request and replies with a fixed JSON body. Returns the
 * server, its base URL, and the array of captured requests.
 */
function startMockServer(): Promise<{ server: Server; baseUrl: string; captured: CapturedRequest[] }> {
  const captured: CapturedRequest[] = []
  return new Promise((resolvePromise) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      // Drain the body to allow the connection to close cleanly even though
      // GET requests carry none.
      req.on('data', () => {})
      req.on('end', () => {
        captured.push({ url: req.url, method: req.method, headers: { ...req.headers } })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo
      resolvePromise({ server, baseUrl: `http://127.0.0.1:${addr.port}`, captured })
    })
  })
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    // Force-close any keepalive sockets so close() resolves promptly. Without
    // this, the test process can hang for the OS-default socket timeout when
    // Node's fetch client leaves a connection idle.
    server.closeAllConnections?.()
    server.close((err) => (err ? rejectPromise(err) : resolvePromise()))
  })
}

interface SpawnResult {
  status: number | null
  stdout: string
  stderr: string
}

/**
 * Async-spawn the generated CLI and capture its stdio. Asynchronous on
 * purpose: the parent process holds the mock HTTP server, so we cannot use
 * `spawnSync` — that would block the event loop and the server would never
 * accept the subprocess's connection.
 */
function runCli(args: string[]): Promise<SpawnResult> {
  const nodeModules = resolve(process.cwd(), 'node_modules')
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      env: { ...process.env, NODE_PATH: nodeModules },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', rejectPromise)
    child.on('close', (code: number | null) => resolvePromise({ status: code, stdout, stderr }))
  })
}

test('header params: required header is sent when --x-request-id flag is provided', async () => {
  await withTmp(async (dir) => {
    const out = join(dir, 'gen')
    await generate({ spec: FIXTURE, output: out, name: 'headers-cli', version: '0.1.0' })

    const { server, baseUrl, captured } = await startMockServer()
    try {
      const result = await runCli([
        join(out, 'bin/cli.js'),
        '--base-url',
        baseUrl,
        'echo-headers',
        '--x-request-id',
        'req-abc-123',
        '--x-trace-id',
        'trace-xyz-456',
      ])
      assert.equal(result.status, 0, `cli exited ${result.status}; stderr=${result.stderr}`)
      assert.equal(captured.length, 1, 'expected exactly one request')
      const req = captured[0]!
      // Node lowercases header names on IncomingMessage.headers — that is the
      // canonical comparison surface, regardless of the casing the runtime
      // emitted.
      assert.equal(req.headers['x-request-id'], 'req-abc-123')
      assert.equal(req.headers['x-trace-id'], 'trace-xyz-456')
    } finally {
      await stopServer(server)
    }
  })
})

test('header params: optional header is omitted when --x-trace-id flag is not provided', async () => {
  await withTmp(async (dir) => {
    const out = join(dir, 'gen')
    await generate({ spec: FIXTURE, output: out, name: 'headers-cli', version: '0.1.0' })

    const { server, baseUrl, captured } = await startMockServer()
    try {
      const result = await runCli([
        join(out, 'bin/cli.js'),
        '--base-url',
        baseUrl,
        'echo-headers',
        '--x-request-id',
        'req-only',
      ])
      assert.equal(result.status, 0, `cli exited ${result.status}; stderr=${result.stderr}`)
      assert.equal(captured.length, 1, 'expected exactly one request')
      const req = captured[0]!
      assert.equal(req.headers['x-request-id'], 'req-only')
      assert.equal(
        req.headers['x-trace-id'],
        undefined,
        'optional header must be absent when flag is not supplied'
      )
    } finally {
      await stopServer(server)
    }
  })
})

test('header params: missing required header flag fails fast with usage error', async () => {
  await withTmp(async (dir) => {
    const out = join(dir, 'gen')
    await generate({ spec: FIXTURE, output: out, name: 'headers-cli', version: '0.1.0' })

    const result = await runCli([join(out, 'bin/cli.js'), 'echo-headers'])
    assert.equal(result.status, 1)
    const err = JSON.parse(result.stderr) as { error: string }
    assert.equal(err.error, 'usage')
  })
})
