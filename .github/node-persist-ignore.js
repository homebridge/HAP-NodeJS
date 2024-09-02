/**
 * This script tried to solve the problem of having types collisions of node-persist types.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const storageDefinition = './dist/lib/model/HAPStorage.d.ts'
const resolved = resolve(storageDefinition)

if (!existsSync(resolved)) {
  throw new Error('Tried to update definition but could not find HAPStorage.d.ts!')
}

const rows = readFileSync(resolved, 'utf8').split('\n')
rows.unshift('// @ts-expect-error')

writeFileSync(resolved, rows.join('\n'))
