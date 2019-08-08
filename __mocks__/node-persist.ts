class Storage {
  getItem = jest.fn();
  setItemSync = jest.fn();
  persistSync = jest.fn();
  removeItemSync = jest.fn();
}

export default new Storage();
