var fs = require('fs')
  , child_process = require('child_process')
  , _glob = require('glob')
  , bunch = require('./bunch')
  ;

exports.loadEnv = function loadEnv(env, cb) {
  var loaders = []
  function load(name, cb) {
    fs.readFile(env[name], function(error, data) {
      env[name] = env[name].match(/.*\.json$/) ?  JSON.parse(data) : data;
      cb(error, data)
    })
  }
  for (var name in env) {
    loaders.push([load, name])
  }
  bunch(loaders, cb)
}

exports.commandActor = function command(executable) {
  return function command(args, opts, cb) {
    if (!cb) {
      cb = opts;
      opts = {}
    }
    var cmd = child_process.spawn(executable, args, opts);
    function log(b) { console.log(b.toString()) } 
    cmd.stdout.on('data', log);
    cmd.stderr.on('data', log);
    cmd.on('exit', function(code) {
      if (code) {
        cb(new Error(executable + ' exited with status ' + code));
      } else {
        cb();
      }
    });
    return cmd;
  }
}

exports.jsonParse = function(str, cb) {
  try {
    cb(null, JSON.parse(str));
  } catch (ex) {
    cb(ex);
  }
}

exports.jsonStringify = function(obj, cb) {
  try {
    cb(null, JSON.stringify(obj));
  } catch (ex) {
    cb(ex);
  }
}
exports.glob = function glob(pattern, cb) {
  console.log('pattern', pattern);
  _glob(pattern, function(error, files) {
    cb(error, [files]);
  });
}

