module.exports = function bunch(tasks, cb) {
  var count = 0, has_error;
  function done(error) {
    if (error) {
      has_error = error;
      cb(error);
    }
    if (++count === tasks.length && ! has_error) cb();
  }
  tasks.forEach(function(t) { t[0].apply(null, t.slice(1).concat([done])) });
}

