
var path = require('path')
  , ejs = require('ejs')
  , obj = require('./obj')
  ;

exports.make_relative = function make_relative(paths, dst, root) {
  var result = [];
  var r = dst.substr(0, root.length);
  if ( r !== root) {
    console.log('KAPUTT');
  }
  dst = dst.substr(root.length)
  return paths.map(function(p) { return path.relative(path.dirname(dst), p) });
}

var helpers = exports.helpers = function helpers(ctx, options) {
  options = options || {};
  var helpers = {};
  helpers.title = function title(t) { if(t) {ctx.title = t} return ctx.title }
  helpers.script = function script(s) { ctx.scripts.push(s) }
  helpers.stylesheet = function stylesheet(s) { ctx.stylesheets.push(s) }
  helpers.path = exports.getPathHelper(options)
  return helpers;
}

function passthrough(p) { return p }

exports.getPathHelper = function getPathHelper(options) {
  if (options.outputDir) {
    return function _path(p) {
      var r = options.dst.substr(0, options.outputDir.length);
      if ( r !== options.outputDir) { throw new Error('KAPUTT') }
      var dst = options.dst.substr(options.outputDir.length);
      var relpath =  path.relative(path.dirname(dst), p);
      return relpath;
    }
  } else {
    return function _path(p) { return p }
  }
}


exports.render = function render(source, options, cb) {
  var metadata = { stylesheets: [], scripts: []}
    , locals = helpers(metadata, options)
    ;
  locals = obj.union(options.locals || {}, locals);
  metadata.body = ejs.render(source, locals);
  metadata.path = exports.getPathHelper(options);
  var html = ejs.render(options.layout.toString(), metadata);
  cb(null, html);
}
