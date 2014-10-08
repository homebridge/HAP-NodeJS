/*
 * Simon Last, Sept 2013
 * http://simonlast.org
 */

var fs     = require('fs'),
    path   = require('path'),
    mkdirp = require("mkdirp"),
    _      = require("underscore"),
    sugar  = require("sugar");

var options = {};
var defaults = {
    dir: 'persist',
    stringify: JSON.stringify,
    parse: JSON.parse,
    encoding: 'utf8',
    logging: false,
    continuous: true,
    interval: false
};

var data = {};
var changes = {};

var dir = __dirname;


/*
 * This function, (or initSync) must be called before the library can be used.
 * An options hash can be optionally passed.
 */
exports.init = function (userOptions) {

    setOptions(userOptions);

    if (options.logging) {
        console.log("options:");
        console.log(options);
    }

    //remove cached data
    data = {};

    //check to see if dir is present
    fs.exists(options.dir, function (exists) {
        if (exists) {
            //load data
            fs.readdir(options.dir, function (err, arr) {
                for (var i in arr) {
                    var curr = arr[i];
                    if (curr[0] !== '.') {
                        parseFile(curr);
                    }
                }
            });
        } else {

            //create the directory
            mkdirp(options.dir, function (err) {
                if (err) console.error(err);
                else if(options.logging) console.log('created ' + options.dir);

            });
        }
    });

    //start persisting
    if (options.interval && options.interval > 0)
        setInterval(exports.persist, options.interval);
};


/*
 * This function, (or init) must be called before the library can be used.
 * An options hash can be optionally passed.
 */
exports.initSync = function (userOptions) {

    setOptions(userOptions);

    if (options.logging) {
        console.log("options:");
        console.log(options);
    }

    //remove cached data
    data = {};

    //check to see if dir is present
    var exists = fs.existsSync(options.dir);
    if (exists) { //load data
        var arr = fs.readdirSync(options.dir);
        for (var i in arr) {
            var curr = arr[i];
            if (curr[0] !== '.') {
                var json = fs.readFileSync(path.join(options.dir, curr),
                    options.encoding);
                var value = parseString(json);
                data[curr] = value;
            }
        }
    } else { //create the directory
        mkdirp.sync(options.dir);
    }

    //start persisting
    if (options.interval && options.interval > 0)
        setInterval(exports.persistSync, options.interval);
};


/*
 * This function returns a key with index n in the database, or null if
 *  it is not present.
 * This function runs in 0(k), where k is the number of keys in the
 *  database. You probably shouldn't use it.
 */
exports.key = function (n) {
    var keys = Object.keys(data);
    if (keys.length <= n) {
        return null;
    }
    return keys[n];
};


/*
 * This function returns the value associated with a key in the database,
 *  or undefined if it is not present.
 */
exports.getItem = function (key) {
    return data[key];
};


/*
 * This function returns all the values in the database.
 */
exports.values = function(callback) {
        callback(_.values(data));
};


exports.valuesWithKeyMatch = function(match, callback) {
    callback(
        _.filter(data, function(value, key){
            console.log(key);
            return key.has(match);
        }));
};


/*
 * This function sets a key to a given value in the database.
 */
exports.setItem = function (key, value, cb) {
    data[key] = value;
    if (options.interval) {
        changes[key] = true;
    } else if (options.continuous) {
        exports.persistKey(key, cb);
    }
    if (options.logging)
        console.log("set (" + key + ": " + value + ")");
};


/*
 * This function removes key in the database if it is present, and
 *  immediately deletes it from the file system asynchronously.
 */
exports.removeItem = function (key) {
    delete data[key];
    removePersistedKey(key);
    if (options.logging)
        console.log("removed" + key);
};


/*
 * This function removes all keys in the database, and immediately
 *  deletes all keys from the file system asynchronously.
 */
exports.clear = function () {
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
        removePersistedKey(keys[i]);
    }
    data = {};
};


/*
 * This function returns the number of keys stored in the database.
 */
exports.length = function () {
    return Object.keys(data).length;
};


/*
 * This function triggers the database to persist asynchronously.
 */
exports.persist = function () {
    for (var key in data) {
        if (changes[key]) {
            exports.persistKey(key);
        }
    }
};


/*
 * This function triggers the database to persist synchronously.
 */
exports.persistSync = function () {
    for (var key in data) {
        if (changes[key]) {
            exports.persistKeySync(key);
        }
    }
};


/*
 * This function triggers a key within the database to persist asynchronously.
 */
exports.persistKey = function (key, cb) {
    var json = options.stringify(data[key]);
    fs.writeFile(path.join(options.dir, key), json, options.encoding, cb);
    changes[key] = false;
    if (options.logging)
        console.log("wrote: " + key);
};


/*
 * This function triggers a key within the database to persist synchronously.
 */
exports.persistKeySync = function (key) {
    var json = options.stringify(data[key]);
    fs.writeFile(path.join(options.dir, key), json,
        options.encoding, function (err) {
            if (err) throw err;
        }
    );
    changes[key] = false;

    if (options.logging)
        console.log("wrote: " + key);
};


/*
 * Helper functions.
 */

var removePersistedKey = function (key) {
    //check to see if key has been persisted
    var file = path.join(options.dir, key);
    fs.exists(file, function (exists) {
        if (exists) {
            fs.unlink(file, function (err) {
                if (err) throw err;
            });
        }
    });
};


var setOptions = function (userOptions) {
    if (!userOptions) {
        options = defaults;
    } else {
        for (var key in defaults) {
            if (userOptions[key]) {
                options[key] = userOptions[key];
            } else {
                options[key] = defaults[key];
            }
        }

        // dir is not absolute
        options.dir = path.normalize(options.dir);
        if (options.dir !== path.resolve(options.dir)) {
            options.dir = path.join(dir, "persist", options.dir);
            if (options.logging) {
                console.log("Made dir absolute: " + options.dir);
            }
        }

    }
};


var parseString = function(str){
    try{
        return options.parse(str);
    }catch(e){
        if(options.logging){
            console.log("parse error: ", e);
        }
        return {};
    }
};


var parseFile = function (key) {
    fs.readFile(path.join(options.dir, key), options.encoding, function (err, json) {
        if (err) throw err;
        var value = parseString(json);
        data[key] = value;
        if (options.logging) {
            console.log("loaded: " + key);
        }
    });
};