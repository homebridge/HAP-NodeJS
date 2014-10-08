
var fs     = require('fs')
  , path = require('path')
  , mkdirp = require('mkdirp')
  , obj = require('./obj')
  ;

exports.compiler = function compiler(f, name, options) {
  options = options || {};
  return function(src, dst, dynamic_options, cb) {
    if ( ! cb ) {
      cb = dynamic_options;
      dynamic_options = {};
    }
    var all_options = resolve_options(src, dst, options, dynamic_options)
    fs.readFile(src, function(error, data) {
      if (error) return cb(error);
      f(data.toString(), all_options, function(error, result) {
        if (error) {
          cb(error);
        } else {
          mkdir_and_write_file(dst, result, cb);
        }
      });
    });
  }
}

exports.compilerSync = function compilerSync(f, name, options) {
  options = options || {};
  return function(src, dst, dynamic_options, cb) {
    if ( ! cb ) {
      cb = dynamic_options;
      dynamic_options = {};
    }
    console.log('[' + name + ']', dst)
    var all_options = resolve_options(src, dst, options, dynamic_options)
    fs.readFile(src, function(error, data) {
      if (error) return cb(error);
      var result = f(data.toString(), all_options);
      mkdir_and_write_file(dst, result, cb);
    });
  }
}

exports.src = {};
exports.dst = {};

function resolve_options(src, dst /*, options, ... */) {
  var option_objects = Array.prototype.slice.call(arguments, 2)
    , options = obj.union.apply(null, option_objects);
  for (var opt in options) {
    if (options[opt] === exports.src) {
      options[opt] = src;
    } else if (options[opt] === exports.dst) {
      options[opt] = dst;
    }
  }
  return options;
}

function mkdir_and_write_file(file, content, cb) {
  mkdirp(path.dirname(file), function(error) {
    if (error) {
      cb(error)
    } else {
      fs.writeFile(file, content, cb)
    }
  });
}
