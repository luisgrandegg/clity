#!/usr/bin/env node
// Regenerates the test snapshots by re-running the test suite with
// UPDATE_SNAPSHOTS=1. Cross-platform alternative to setting the env var inline
// (which differs between POSIX shells and Windows cmd.exe / PowerShell).
//
// Usage: pnpm test:update

import { spawnSync } from 'node:child_process'

const result = spawnSync('pnpm', ['test'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, UPDATE_SNAPSHOTS: '1' },
})

process.exit(result.status ?? 1)
