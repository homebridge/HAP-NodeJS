'use strict';

module.exports = {
  clone: clone
};


/**
 * A simple clone function that also allows you to pass an "extend" object whose properties will be
 * added to the cloned copy of the original object passed.
 */
function clone(object, extend) {

  var cloned = {};

  for (var key in object) {
    cloned[key] = object[key];
  }

  for (var key in extend) {
    cloned[key] = extend[key];
  }

  return cloned;
};
