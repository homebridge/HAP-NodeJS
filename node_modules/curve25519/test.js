var curve = require("./build/default/curve");

var buf1 = new Buffer(64);
var buf2 = new Buffer(64);
var buf3 = new Buffer(64);
console.log(buf1.toString('base64'));
curve.curve(buf1,buf2,buf3);
console.log(buf1.toString('base64'));
