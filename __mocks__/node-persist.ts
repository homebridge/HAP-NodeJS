class Storage {
  getItem = jest.fn().mockResolvedValue(undefined);
  setItem = jest.fn().mockResolvedValue(undefined);
  removeItem = jest.fn().mockResolvedValue(undefined);
  initSync = jest.fn();
  init = jest.fn().mockResolvedValue(undefined);
  create = jest.fn().mockImplementation(() => new Storage());
}

export default new Storage();
