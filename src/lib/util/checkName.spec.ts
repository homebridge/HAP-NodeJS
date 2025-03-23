import { checkName } from "./checkName";

describe("#checkName()", () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  test("Accessory Name ending with !", async () => {
    checkName("displayName", "Name", "bad name!");

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line max-len
    expect(consoleWarnSpy).toHaveBeenCalledWith("HAP-NodeJS WARNING: The accessory 'displayName' has an invalid 'Name' characteristic ('bad name!'). Please use only alphanumeric, space, and apostrophe characters. Ensure it starts and ends with an alphabetic or numeric character, and avoid emojis. This may prevent the accessory from being added in the Home App or cause unresponsiveness.");
  });

  test("Accessory Name beginning with !", async () => {
    checkName("displayName", "Name", "!bad name");

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line max-len
    expect(consoleWarnSpy).toHaveBeenCalledWith("HAP-NodeJS WARNING: The accessory 'displayName' has an invalid 'Name' characteristic ('!bad name'). Please use only alphanumeric, space, and apostrophe characters. Ensure it starts and ends with an alphabetic or numeric character, and avoid emojis. This may prevent the accessory from being added in the Home App or cause unresponsiveness.");
  });

  test("Accessory Name containing !", async () => {
    checkName("displayName", "Name", "bad ! name");

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line max-len
    expect(consoleWarnSpy).toHaveBeenCalledWith("HAP-NodeJS WARNING: The accessory 'displayName' has an invalid 'Name' characteristic ('bad ! name'). Please use only alphanumeric, space, and apostrophe characters. Ensure it starts and ends with an alphabetic or numeric character, and avoid emojis. This may prevent the accessory from being added in the Home App or cause unresponsiveness.");
  });

  test("Accessory Name beginning with '", async () => {
    checkName("displayName", "Name", " 'bad name");

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line max-len
    expect(consoleWarnSpy).toHaveBeenCalledWith("HAP-NodeJS WARNING: The accessory 'displayName' has an invalid 'Name' characteristic (' 'bad name'). Please use only alphanumeric, space, and apostrophe characters. Ensure it starts and ends with an alphabetic or numeric character, and avoid emojis. This may prevent the accessory from being added in the Home App or cause unresponsiveness.");
  });

  test("Accessory Name containing '", async () => {
    checkName("displayName", "Name", "good ' name");

    expect(consoleWarnSpy).toHaveBeenCalledTimes(0);
  });
});
