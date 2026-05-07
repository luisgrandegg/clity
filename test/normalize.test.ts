import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { normalize } from '../src/generator/normalize.js'
import { parseSpec } from '../src/generator/parse.js'

const FIXTURE = resolve(process.cwd(), 'test/fixtures/petstore.json')

test('normalize derives kebab-case commands from operationId', async () => {
  const doc = await parseSpec(FIXTURE)
  const spec = normalize({
    doc,
    cliName: 'petstore',
    cliVersion: '0.1.0',
    specSource: FIXTURE,
    generatorVersion: 'test',
  })

  const commands = spec.operations.map((o) => o.command)
  assert.ok(commands.includes('add-pet'), `missing addPet → add-pet, got: ${commands.join(',')}`)
  assert.ok(commands.includes('get-pet-by-id'))
  assert.ok(commands.includes('find-pets-by-status'))
  assert.ok(commands.includes('place-order'))
})

test('normalize maps params correctly', async () => {
  const doc = await parseSpec(FIXTURE)
  const spec = normalize({
    doc,
    cliName: 'petstore',
    cliVersion: '0.1.0',
    specSource: FIXTURE,
    generatorVersion: 'test',
  })

  const getPet = spec.operations.find((o) => o.command === 'get-pet-by-id')
  assert.ok(getPet, 'get-pet-by-id not found')
  const petId = getPet!.params.find((p) => p.name === 'petId')
  assert.ok(petId, 'petId param not found')
  assert.equal(petId!.in, 'path')
  assert.equal(petId!.required, true)
  assert.equal(petId!.flagName, 'pet-id')
  assert.equal(petId!.type, 'integer')
})

test('normalize maps request body', async () => {
  const doc = await parseSpec(FIXTURE)
  const spec = normalize({
    doc,
    cliName: 'petstore',
    cliVersion: '0.1.0',
    specSource: FIXTURE,
    generatorVersion: 'test',
  })

  const addPet = spec.operations.find((o) => o.command === 'add-pet')
  assert.ok(addPet)
  assert.ok(addPet!.requestBody, 'requestBody missing')
  assert.equal(addPet!.requestBody!.required, true)
  assert.equal(addPet!.requestBody!.contentType, 'application/json')
})

test('normalize maps security schemes', async () => {
  const doc = await parseSpec(FIXTURE)
  const spec = normalize({
    doc,
    cliName: 'petstore',
    cliVersion: '0.1.0',
    specSource: FIXTURE,
    generatorVersion: 'test',
  })

  const names = spec.security.map((s) => s.name).sort()
  assert.deepEqual(names, ['api_key', 'bearerAuth'])

  const bearer = spec.security.find((s) => s.name === 'bearerAuth')!
  assert.equal(bearer.type, 'http')
  assert.equal(bearer.scheme, 'bearer')

  const apiKey = spec.security.find((s) => s.name === 'api_key')!
  assert.equal(apiKey.type, 'apiKey')
  assert.equal(apiKey.in, 'header')
  assert.equal(apiKey.paramName, 'api_key')
})

test('normalize per-operation security overrides root security', async () => {
  const doc = await parseSpec(FIXTURE)
  const spec = normalize({
    doc,
    cliName: 'petstore',
    cliVersion: '0.1.0',
    specSource: FIXTURE,
    generatorVersion: 'test',
  })

  const getPet = spec.operations.find((o) => o.command === 'get-pet-by-id')!
  assert.deepEqual(getPet.security, ['api_key'])

  // No per-op security on add-pet → falls back to the root `security` block
  const addPet = spec.operations.find((o) => o.command === 'add-pet')!
  assert.deepEqual(addPet.security, ['bearerAuth'])
})

test('normalize returns deterministic output', async () => {
  const doc1 = await parseSpec(FIXTURE)
  const doc2 = await parseSpec(FIXTURE)
  const spec1 = normalize({
    doc: doc1,
    cliName: 'petstore',
    cliVersion: '0.1.0',
    specSource: FIXTURE,
    generatorVersion: 'test',
  })
  const spec2 = normalize({
    doc: doc2,
    cliName: 'petstore',
    cliVersion: '0.1.0',
    specSource: FIXTURE,
    generatorVersion: 'test',
  })
  assert.equal(JSON.stringify(spec1), JSON.stringify(spec2))
})

// Sanity: make sure the fixture itself parses. Useful diagnostic if a future
// edit corrupts the JSON.
test('petstore fixture is valid JSON', () => {
  const raw = readFileSync(FIXTURE, 'utf8')
  const obj = JSON.parse(raw) as { openapi?: string }
  assert.ok(typeof obj.openapi === 'string')
})
