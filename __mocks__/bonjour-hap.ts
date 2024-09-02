import { vi } from 'vitest'

class Advertisement {
  updateTxt = vi.fn()
  stop = vi.fn()
  destroy = vi.fn()
}

function publishFn() {
  return new Advertisement()
}

class BonjourService {
  publish = vi.fn(publishFn)
  destroy = vi.fn()
}

export default () => {
  return new BonjourService()
}
