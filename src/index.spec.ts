// we just test that we can import index e.g. without any cyclic imports
import "./index";

describe("index", () => {
  test("test index import", () => {
    expect(true).toBeTruthy();
  });
});
