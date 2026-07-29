import { IdentifierCache } from "./IdentifierCache";
import { HAPStorage } from "./HAPStorage";

const createIdentifierCache = (username = "username") => {
  return new IdentifierCache(username);
};

describe("IdentifierCache", () => {

  describe("#startTrackingUsage()", () => {

    it ("creates a cache to track usage and expiring keys", () => {
      const identifierCache = createIdentifierCache();

      expect(identifierCache._usedCache).toBeNull();
      identifierCache.startTrackingUsage();
      expect(identifierCache._usedCache).toEqual({});
    });
  });

  describe("#stopTrackingUsageAndExpireUnused()", () => {
    it ("creates a cache to track usage and expiring keys", () => {
      const identifierCache = createIdentifierCache();

      expect(identifierCache._usedCache).toBeNull();
      identifierCache.startTrackingUsage();
      expect(identifierCache._usedCache).toEqual({});
      identifierCache.stopTrackingUsageAndExpireUnused();
      expect(identifierCache._usedCache).toBeNull();
    });
  });

  describe("#getCache()", () => {
    it ("retrieves an item from the cache", () => {
      const identifierCache = createIdentifierCache();

      const VALUE = 1;
      identifierCache.setCache("foo", VALUE);

      expect(identifierCache.getCache("foo")).toEqual(VALUE);
    });

    it ("returns undefined if an item is not found in the cache", () => {
      const identifierCache = createIdentifierCache();

      expect(identifierCache.getCache("foo")).toBeUndefined();
    });
  });

  describe("#setCache()", () => {
    it ("overwrites an existing item in the cache", () => {
      const identifierCache = createIdentifierCache();

      const VALUE = 2;
      identifierCache.setCache("foo", 1);
      identifierCache.setCache("foo", VALUE);

      expect(identifierCache.getCache("foo")).toEqual(VALUE);
    });
  });

  describe("#getAID()", () => {
    it("creates an entry in the cache if the key is not found", () => {
      const identifierCache = createIdentifierCache();

      const result = identifierCache.getAID("00");
      expect(result).toEqual(2);
    });
  });

  describe("#getIID()", () => {
    it("creates an entry in the cache if the key is not found", () => {
      const identifierCache = createIdentifierCache();

      const result = identifierCache.getIID("00", "11", "subtype", "99");
      expect(result).toEqual(2);
    });

    it("creates an entry in the cache if the key is not found, without a characteristic UUID", () => {
      const identifierCache = createIdentifierCache();

      const result = identifierCache.getIID("00", "11", "subtype");
      expect(result).toEqual(2);
    });

    it("creates an entry in the cache if the key is not found, without a service subtype or characteristic UUID", () => {
      const identifierCache = createIdentifierCache();

      const result = identifierCache.getIID("00", "11");
      expect(result).toEqual(2);
    });
  });

  describe("#save()", () => {
    it("persists the cache to file storage", () => {
      const identifierCache = createIdentifierCache();
      identifierCache.setCache("foo", 1);
      identifierCache.save();

      const saved = HAPStorage.storage().getItem(IdentifierCache.persistKey(identifierCache.username));
      expect(saved).toEqual({ cache: { foo: 1 } });
    });
  });

  describe("#remove()", () => {
    it("removes the cache from file storage", () => {
      const identifierCache = createIdentifierCache();
      identifierCache.save();
      expect(HAPStorage.storage().getItem(IdentifierCache.persistKey(identifierCache.username))).toBeDefined();

      IdentifierCache.remove(identifierCache.username);

      expect(HAPStorage.storage().getItem(IdentifierCache.persistKey(identifierCache.username))).toBeUndefined();
    });
  });

  describe("persistKey()", () => {
    it("returns a correctly formatted key for persistence", () => {
      const key = IdentifierCache.persistKey("username");
      expect(key).toEqual("IdentifierCache.USERNAME.json");
    });
  });
});
