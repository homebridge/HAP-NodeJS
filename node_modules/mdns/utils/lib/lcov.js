
var fs = require('fs')
  ;
exports.infoFileToJson = function infoFileToJson(filename, filefilter, cb) {
  var input = fs.createReadStream(filename)
  var parser = new LcovLoader(filefilter)
  function process_lcov_chunk(chunk) { parser.consume(chunk); }
  input.on('data', process_lcov_chunk);
  input.on('end', function() {
    //process.stdout.write(JSON.stringify(parser.result, null, 2));
    cb(null, parser.result)
  });
}



var LcovLoader = exports.LcovLoader = function LcovLoader(filefilter) {
  this.tail = ''
  this.result   = {
      files: {}
    , tests: {}
    , functionCount: {}
  }
  this.testname = '';
  this.filename = '';
  this.filefilter = filefilter || function() { return true };
}
LcovLoader.prototype =
{ tail: ''
, result: {}
, testname: ''
, filename: ''
, filefilter: null
}

LcovLoader.prototype.consume = function consume(chunk) {
  var self = this
    , lines = chunk.toString().split('\n')
    ;
  if (this.tail) { lines[0] = this.tail + lines[0]; }
  this.tail = lines.pop()

  var testname = self.testname
    , filename = self.filename
    , result = self.result
    , functionCount = result.functionCount
    , file = result.files[filename]
    , test = result.tests[filename]
    , count = 0
    , warn_negative = false
    ;
  function consumeLine(line) {
    if (line.match(/^TN:([^,]*)(,diff)?/)) {
      testname = (RegExp.$1 || '') + (RegExp.$2 || '');
      if (testname) result.tests[testname] = {functionCount: {} };
    } else if (line.match(/^[SK]F:(.*)/)) {
      filename = RegExp.$1;
      if (self.filefilter(filename)) {
        if (!result.files[filename]) result.files[filename] = {};
        file = result.files[filename];
        //console.log('file:', filename, file)
        if (testname) {
          if (!result.tests[testname]) result.tests[testname] = {};
          test = result.tests[testname];
        } else {
          test = null;
        }
      } else {
        file = null
      }
    } else if (line.match(/^DA:(\d+),(-?\d+)(,[^,\s]+)?/)) {
      if (!file) { 
        return
      }
      count = parseInt(RegExp.$2)
      if (count < 0) {
        count = 0;
        warn_negative = true;
      }
      if (!file.lines) file.lines = {};
      if (!file.lines[RegExp.$1]) file.lines[RegExp.$1] = 0
      file.lines[RegExp.$1] += count;
      if (test) {
        if (!test.lines) test.lines = {};
        if (!test.lines[RegExp.$1]) test.lines[RegExp.$1] = 0;
        test.lines[RegExp.$1] += count;
      }
    } else if (line.match(/^FN:(\d+),([^,]+)/)) {
      if (!file) { 
        return
      }
      if (!file.functions) file.functions = {};
      file.functions[RegExp.$2] = {};
      file.functions[RegExp.$2].line = parseInt(RegExp.$1);
      functionCount[RegExp.$2] = 0;
      if (test && ! test.functionCount[RegExp.$2]) test.functionCount[RegExp.$2] = 0
    } else if (line.match(/^FNDA:(\d+),([^,]+)/)) {
      if (!file) { 
        return
      }
      functionCount[RegExp.$2] += parseInt(RegExp.$1);
    } else if (line.match(/^BRDA:(\d+),(\d+),(\d+),(\d+|-)/)) {
      if (!file) {
        return
      }
      if (!file.branches) { file.branches = {} }
      var line = RegExp.$1
        , block = RegExp.$2
        , branch = RegExp.$3
        , taken  = RegExp.$4
        ;
      if(!file.branches[block]) {file.branches[block] = {}};
      if(!file.branches[block][branch]) {file.branches[block][branch] = 0};
      file.branches[block][branch] += parseInt(taken);
      //console.log('line:', line, 'block:', block, 'branch:', branch, 'taken:', taken)
    } else if (line.match(/^end_of_record/)) {
    } else {
      //console.log('unhandled:', line)
    }
  }

  lines.forEach(consumeLine);

  self.filename = filename;
  self.testname = testname;
}

