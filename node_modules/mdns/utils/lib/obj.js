exports.union = function union(/* object, object, ... */)  {
  if (arguments.length < 2) {
    throw new Error('union() requires at least two arguments');
  }
  var result = {};
  for (var i in arguments) {
    for (var p in arguments[i]) {
      result[p] = arguments[i][p];
    }
  }
  return result;
}
