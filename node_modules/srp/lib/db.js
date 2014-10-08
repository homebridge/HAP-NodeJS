// in-memory db for testing and dev
// yes, there will be persistence :)
var data = {};

exports.store = function store(key, value, callback) {
  data[key] = value;
  return callback(null, true);
};

exports.fetch = function fetch(key, callback) {
  return callback(null, data[key]);
};