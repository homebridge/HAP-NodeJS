#!/usr/bin/env node

var fs = require('fs')
  , path = require('path')
  , nopt = require('nopt')
  , mm = require('minimatch')
  , lcov = require('./lcov')
  , slide = require('slide')
  , ejs = require('ejs')
  , mkdirp = require('mkdirp')
  , view = require('./view')
  , obj = require('./obj')

  , knownOptions =
    { match    : String
    , template : path
    }
  , parsedOptions = nopt(knownOptions)
  , rootd = path.resolve(__dirname, '..', '..')
  ;

var filefilter = mm.Minimatch(parsedOptions.match || rootd + '/**');
filter = function(f) { return filefilter.match(f) };

var chain = slide.chain
  , meta = {}
  , outd = path.join(rootd, 'build')
  , pagedir = path.join(outd, 'pages')
  , docd = path.join(rootd, 'doc')
  , lcov_info_file = path.join(outd, 'reports', 'coverage', 'cpp', 'testrun_all.info')
  , json_report = path.join(outd, 'reports', 'coverage', 'testrun_coverage-cpp.json')
  , prerequisites =
    { layout: path.join(docd, 'layout.ejs')
    , source_template: path.join(docd, 'build', 'source.ejs')
    }
  ;

chain( [ [ load_prerequisites, meta, prerequisites]
       , [ lcov.infoFileToJson, lcov_info_file, filter]
       , [ save_json, chain.last, json_report]
       , [ render_pages, chain.last]
       ]
     , function(error) {
         console.log('done', error);
         if (error) { process.exit(1) }
       }
     );

function save_json(report, file, cb) {
  fs.writeFile(file, JSON.stringify(report, null, 2), function(err) {
    console.log('================================================================================');
    console.log('testrun c++ coverage report saved to', file.replace(/.*\/(build\/.*)/, "$1"));
    console.log('================================================================================');
    cb(err, report);
  });
}

function render_pages(coverage, cb) {
  var pages = Object.keys(coverage.files)
    , stripped_names = strip_common_path(pages, 1)
    , funcs = pages.map(function(p,i) {
        return [render_source_page, p, stripped_names[i], coverage.files[p], coverage.functionCount, meta]
      })
    ;
  bunch(funcs, cb);
}

function render_source_page(file, stripped_name, coverage, functions, meta, cb) {
  var outfile = path.join(pagedir, 'coverage', stripped_name) + '.html';
  chain( [ [ fs.readFile, file ]
         , [ render_source_view, chain.last, stripped_name, coverage, functions, outfile, meta ]
         , [ mkdirp, path.dirname(outfile) ]
         , [ fs.writeFile, outfile, chain.last ]
         ]
       , cb
       )
}

function pad(n, len) {
  var str = '' + n;
  while (str.length < len) { str = ' ' + str }
  return str
}

function hit_counts(coverage, line_count) {
  var hit_lines = [];
  for (var i = 1; i <= line_count; ++i) {
    if (coverage.lines[i]) {
      hit_lines.push(coverage.lines[i])
    } else {
      hit_lines.push(0)
    }
  }
  var num_digits = number_of_digits( Math.max.apply(null, hit_lines))
    ;
  return hit_lines.map(function(lc) { return lc ? pad(lc, num_digits) : '&nbsp;' }).join('\n')
}

function number_of_digits(n) { return Math.ceil(Math.log(n)/Math.LN10) }

function render_source_view(source, name, coverage, functions, dst, meta, cb) {
  var lines = source.toString().split('\n')
    ;
  if (lines[lines.length - 1] === '') {
    lines.pop()
  }

  var metadata =
    { stylesheets: 
      [ '/stylesheets/mdns.css'
      , '/stylesheets/build_status.css'
      ]
    , scripts: []
    , title: 'Test Coverage of ' + name
    };
  var locals = { lines: lines
               , coverage: coverage
               , path: name.split('/')
               , escape: require('ejs/lib/utils').escape
               , counts: found_and_hit(coverage, functions)
               };
  locals = obj.union(locals, view.helpers(metadata, {outputDir: pagedir, dst: dst}));
  metadata.body = ejs.render(meta.source_template.toString(), locals);
  metadata.path = view.getPathHelper({outputDir: pagedir, dst: dst});
  var html = ejs.render(meta.layout.toString(), metadata);
  cb(null, html);
}

function found_and_hit(coverage, function_calls) {
  var result = { lines:     {found: 0, hit: 0}
               , functions: {found: 0, hit: 0}
               , branches:  {found: 0, hit: 0}
               };
  function fnh(things, out) {
    for (var p in things) {
      out.found += 1;
      if (things[p] > 0) {
        out.hit += 1;
      }
    }
  }
  fnh(coverage.lines, result.lines);
  for (var f in coverage.functions) {
    result.functions.found += 1;
    if (function_calls[f] > 0) {
      result.functions.hit += 1;
    }
  }
  return result;
}

function load(file, data, name, cb) {
  fs.readFile(file, function(error, content) {
    if (error) { cb(error); return }
    data[name] = content;
    cb()
  });
}

function load_prerequisites(data, things, cb) {
  var funcs = [];
  for (var p in things) {
    funcs.push([load, things[p], data, p]);
  }

  bunch(funcs, cb);
}


function strip_common_path(names, keep_common) {
  var paths = names.map(function(n) {return n.split('/')})
    , common_elements = 0
    , first
    , all_equal = true;
    ;
  while (all_equal) {
    first = paths[0][common_elements];
    all_equal = paths.every(function(p) { return p[common_elements] === first});
    if (all_equal) common_elements += 1;
  }
  common_elements -= 1;
  common_elements -= keep_common;
  if (common_elements < 0) {
    return
  }

  return paths.map(function(p) { return p.slice(common_elements).join('/') })

}

function bunch(things, cb) {
  var count = 0, has_error;
  function done(error) {
    count += 1;
    if (error && ! has_error) {
      has_error = error;
      cb(error);
    }
    if ( ! has_error && count == things.length) {
      cb();
    }
  }
  things.forEach(function(t) { t[0].apply(null, t.slice(1).concat([done])) });
}

// vim: filetype=javascript :
