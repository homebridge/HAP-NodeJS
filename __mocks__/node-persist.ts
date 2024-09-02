import { vi } from 'vitest'

const createFn = vi.fn().mockImplementation(() => new Storage())

class Storage {
  getItem = vi.fn()
  setItemSync = vi.fn()
  persistSync = vi.fn()
  removeItemSync = vi.fn()
  initSync = vi.fn()
  create = createFn
}

export default new Storage()
