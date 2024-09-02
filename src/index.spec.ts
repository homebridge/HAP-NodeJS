// we just test that we can import index e.g. without any cyclic imports
import { describe, expect, it } from 'vitest'

import './index.js'

describe('index', () => {
  it('test index import', () => {
    expect(true).toBeTruthy()
  })
})
