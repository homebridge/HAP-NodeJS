import type { MockInstance } from 'vitest'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { checkName } from './checkName.js'

describe('#checkName()', () => {
  let consoleWarnSpy: MockInstance

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('accessory Name ending with !', async () => {
    checkName('displayName', 'Name', 'bad name!')

    expect(consoleWarnSpy).toBeCalledTimes(1)

    expect(consoleWarnSpy).toHaveBeenCalledWith('HAP-NodeJS WARNING: The accessory \'displayName\' has an invalid \'Name\' characteristic (\'bad name!\'). Please use only alphanumeric, space, and apostrophe characters. Ensure it starts and ends with an alphabetic or numeric character, and avoid emojis. This may prevent the accessory from being added in the Home App or cause unresponsiveness.')
  })

  it('accessory Name beginning with !', async () => {
    checkName('displayName', 'Name', '!bad name')

    expect(consoleWarnSpy).toBeCalledTimes(1)

    expect(consoleWarnSpy).toHaveBeenCalledWith('HAP-NodeJS WARNING: The accessory \'displayName\' has an invalid \'Name\' characteristic (\'!bad name\'). Please use only alphanumeric, space, and apostrophe characters. Ensure it starts and ends with an alphabetic or numeric character, and avoid emojis. This may prevent the accessory from being added in the Home App or cause unresponsiveness.')
  })

  it('accessory Name containing !', async () => {
    checkName('displayName', 'Name', 'bad ! name')

    expect(consoleWarnSpy).toBeCalledTimes(1)

    expect(consoleWarnSpy).toHaveBeenCalledWith('HAP-NodeJS WARNING: The accessory \'displayName\' has an invalid \'Name\' characteristic (\'bad ! name\'). Please use only alphanumeric, space, and apostrophe characters. Ensure it starts and ends with an alphabetic or numeric character, and avoid emojis. This may prevent the accessory from being added in the Home App or cause unresponsiveness.')
  })

  it('accessory Name beginning with apostrophe', async () => {
    checkName('displayName', 'Name', ' \'bad name')

    expect(consoleWarnSpy).toBeCalledTimes(1)

    expect(consoleWarnSpy).toHaveBeenCalledWith('HAP-NodeJS WARNING: The accessory \'displayName\' has an invalid \'Name\' characteristic (\' \'bad name\'). Please use only alphanumeric, space, and apostrophe characters. Ensure it starts and ends with an alphabetic or numeric character, and avoid emojis. This may prevent the accessory from being added in the Home App or cause unresponsiveness.')
  })

  it('accessory Name containing apostrophe', async () => {
    checkName('displayName', 'Name', 'good \' name')

    expect(consoleWarnSpy).toBeCalledTimes(0)
  })
})
