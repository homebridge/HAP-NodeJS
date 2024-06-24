import { checkName } from "./checkName";

describe("#checkName()", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "warn");
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test("Accessory Name ending with !", async () => {
    checkName("displayName", "name", "bad name!");

    expect(consoleLogSpy).toBeCalledTimes(1);
    // eslint-disable-next-line max-len
    expect(consoleLogSpy).toHaveBeenCalledWith("HAP-NodeJS WARNING: The accessory 'displayName' is getting published with the characteristic 'name' not following HomeKit naming rules ('bad name!'). Use only alphanumeric, space, and apostrophe characters, start and end with an alphabetic or numeric character, and don't include emojis. This might prevent the accessory from being added to the Home App or leading to the accessory being unresponsive!");
  });

  test("Accessory Name begining with !", async () => {
    checkName("displayName", "name", "!bad name");

    expect(consoleLogSpy).toBeCalledTimes(1);
    // eslint-disable-next-line max-len
    expect(consoleLogSpy).toHaveBeenCalledWith("HAP-NodeJS WARNING: The accessory 'displayName' is getting published with the characteristic 'name' not following HomeKit naming rules ('!bad name'). Use only alphanumeric, space, and apostrophe characters, start and end with an alphabetic or numeric character, and don't include emojis. This might prevent the accessory from being added to the Home App or leading to the accessory being unresponsive!");
  });

  test("Accessory Name containing !", async () => {
    checkName("displayName", "name", "bad ! name");

    expect(consoleLogSpy).toBeCalledTimes(1);
    // eslint-disable-next-line max-len
    expect(consoleLogSpy).toHaveBeenCalledWith("HAP-NodeJS WARNING: The accessory 'displayName' is getting published with the characteristic 'name' not following HomeKit naming rules ('bad ! name'). Use only alphanumeric, space, and apostrophe characters, start and end with an alphabetic or numeric character, and don't include emojis. This might prevent the accessory from being added to the Home App or leading to the accessory being unresponsive!");
  });

  test("Accessory Name begining with '", async () => {
    checkName("displayName", "name", "'bad name");

    expect(consoleLogSpy).toBeCalledTimes(1);
    // eslint-disable-next-line max-len
    expect(consoleLogSpy).toHaveBeenCalledWith("HAP-NodeJS WARNING: The accessory 'displayName' is getting published with the characteristic 'name' not following HomeKit naming rules (''bad name'). Use only alphanumeric, space, and apostrophe characters, start and end with an alphabetic or numeric character, and don't include emojis. This might prevent the accessory from being added to the Home App or leading to the accessory being unresponsive!");
  });

  test("Accessory Name containing '", async () => {
    checkName("displayName", "name", "bad ' name");

    expect(consoleLogSpy).toBeCalledTimes(0);
    // eslint-disable-next-line max-len
    // expect(consoleLogSpy).toHaveBeenCalledWith("HAP-NodeJS WARNING: The accessory 'displayName' is getting published with the characteristic 'name' not following HomeKit naming rules ('bad name!'). Use only alphanumeric, space, and apostrophe characters, start and end with an alphabetic or numeric character, and don't include emojis. This might prevent the accessory from being added to the Home App or leading to the accessory being unresponsive!");
  });

});