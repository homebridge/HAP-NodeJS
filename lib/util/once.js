'use strict';

module.exports = {
  once: once
};

function once(func) {
  var called = false;

  return function() {
    if (called) {
      throw new Error("This callback function has already been called by someone else; it can only be called one time.");
    }
    else {
      called = true;
      return func.apply(this, arguments);
    }
  };
}
