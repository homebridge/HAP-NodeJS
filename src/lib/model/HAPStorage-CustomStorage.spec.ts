import { HAPStorage } from "./HAPStorage";
import { StorageInterface } from "./StorageInterface";

// Mock implementation of custom storage for testing
class MockCustomStorage implements StorageInterface {
  private data: Map<string, any> = new Map(); // eslint-disable-line @typescript-eslint/no-explicit-any

  async getItem(key: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return this.data.get(key);
  }

  async setItem(key: string, value: any): Promise<void> { // eslint-disable-line @typescript-eslint/no-explicit-any
    this.data.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.data.delete(key);
  }

  // Helper method for testing
  clear(): void {
    this.data.clear();
  }

  size(): number {
    return this.data.size;
  }
}

describe("HAPStorage - Custom Storage", () => {
  // Note: HAPStorage is a singleton, so we can only test custom storage once
  // All tests that use custom storage must run in a single test block
  
  it("should support custom storage implementation", async () => {
    const customStorage = new MockCustomStorage();
    
    // Set custom storage (can only be done once)
    HAPStorage.setCustomStorage(customStorage);
    
    const storage = HAPStorage.storage();
    
    // Test setItem
    await storage.setItem("test-key", { data: "test-value" });
    expect(customStorage.size()).toBe(1);
    
    // Test getItem
    const value = await storage.getItem("test-key");
    expect(value).toEqual({ data: "test-value" });
    
    // Test multiple items
    await storage.setItem("key1", "value1");
    await storage.setItem("key2", { nested: "object" });
    await storage.setItem("key3", [1, 2, 3]);
    
    expect(customStorage.size()).toBe(4);
    
    // Retrieve and verify
    expect(await storage.getItem("key1")).toBe("value1");
    expect(await storage.getItem("key2")).toEqual({ nested: "object" });
    expect(await storage.getItem("key3")).toEqual([1, 2, 3]);
    
    // Test removeItem
    await storage.removeItem("test-key");
    expect(customStorage.size()).toBe(3);
    
    // Verify it's gone
    const removedValue = await storage.getItem("test-key");
    expect(removedValue).toBeUndefined();
    
    // Test complex data structures
    const complexData = {
      displayName: "Test Accessory",
      category: 1,
      pincode: "123-45-678",
      pairedClients: {
        "user1": { username: "user1", publicKey: "key1" },
      },
      configVersion: 5,
    };
    
    await storage.setItem("AccessoryInfo.test", complexData);
    const retrieved = await storage.getItem("AccessoryInfo.test");
    expect(retrieved).toEqual(complexData);
    
    // Test undefined/null values
    const notFound = await storage.getItem("non-existent");
    expect(notFound).toBeUndefined();
    
    await storage.setItem("null-key", null);
    const nullValue = await storage.getItem("null-key");
    expect(nullValue).toBeNull();
  });

  it("should throw error if trying to change storage after initialization", () => {
    // Storage is already initialized from the previous test
    const customStorage2 = new MockCustomStorage();
    expect(() => {
      HAPStorage.setCustomStorage(customStorage2);
    }).toThrow("Cannot change storage implementation after it has already been initialized!");
  });

  describe("StorageInterface Contract", () => {
    it("should define the required interface methods", () => {
      // Verify the interface is properly defined by checking a mock implementation
      const mockStorage = new MockCustomStorage();
      
      expect(typeof mockStorage.getItem).toBe("function");
      expect(typeof mockStorage.setItem).toBe("function");
      expect(typeof mockStorage.removeItem).toBe("function");
    });
  });
});
