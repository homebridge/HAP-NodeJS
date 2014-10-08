/**
 * Following utf8 encoding table, found in https://en.wikipedia.org/wiki/UTF-8 with RFC3629 restricting
 * code point values to no more than 0x10FFFF.
 */

var _1_LAST_BITS = 1;
var _2_LAST_BITS = parseInt('11',2);
var _3_LAST_BITS = parseInt('111',2);
var _4_LAST_BITS = parseInt('1111',2);
var _5_LAST_BITS = parseInt('11111',2);
var _6_LAST_BITS = parseInt('111111',2);
var _1_FIRST_BITS = parseInt('10000000',2);
var _2_FIRST_BITS = parseInt('11000000',2);
var _3_FIRST_BITS = parseInt('11100000',2);
var _4_FIRST_BITS = parseInt('11110000',2);
var _5_FIRST_BITS = parseInt('11111000',2);

function addSecondaryBytesIntoCodePoint(codePoint, utf8Bytes, pos, numOfSecBytes) {
	"use strict";
	var b;
	for (var i=0; i<numOfSecBytes; i+=1) {
		b = utf8Bytes[pos+i];
		if ((b & _2_FIRST_BITS) !== _1_FIRST_BITS) {
			throw new Error("Encountered at position "+(pos+i)+" byte "+b.toString(2)+
					", which should be a secondary utf8 byte like 10xxxxxx, but isn't.");
		}
		codePoint <<= 6;
		codePoint += (b & _6_LAST_BITS);
	}
	return codePoint;
}

function decodeUtf8(utf8Bytes) {
	"use strict";
	var byteCounter = 0
		, charCount = 0
		, charArr = new Array(utf8Bytes.length)
		, b, ch, codePoint;
	while (byteCounter < utf8Bytes.length) {
		b = utf8Bytes[byteCounter];
		if ((b & _1_FIRST_BITS) === 0) {
			// 1 byte of the form 0xxxxxxx
			codePoint = b;
			byteCounter += 1;
		} else if ((b & _3_FIRST_BITS) === _2_FIRST_BITS) {
			// 2 bytes, the first one is 110xxxxx, and the last one is 10xxxxxx
			codePoint = (b & _5_LAST_BITS);
			codePoint = addSecondaryBytesIntoCodePoint(codePoint, utf8Bytes, byteCounter+1, 1);
			byteCounter += 2;
		} else if ((b & _4_FIRST_BITS) === _3_FIRST_BITS) {
			// 3 bytes, the first one is 1110xxxx, and last 2 are 10xxxxxx
			codePoint = (b & _4_LAST_BITS);
			codePoint = addSecondaryBytesIntoCodePoint(codePoint, utf8Bytes, byteCounter+1, 2);
			byteCounter += 3;
		} else if ((b & _5_FIRST_BITS) === _4_FIRST_BITS) {
			// 4 bytes, the first one is 11110xxx, and last 3 are 10xxxxxx
			codePoint = (b & _3_LAST_BITS);
			codePoint = addSecondaryBytesIntoCodePoint(codePoint, utf8Bytes, byteCounter+1, 3);
			byteCounter += 4;
		} else {
			throw new Error("Encountered at position "+byteCounter+" byte "+b.toString(2)+
					", which should not be present in a utf8 encoded block.");
		}
		ch = String.fromCharCode(codePoint);
		charArr[charCount] = ch;
		charCount += 1;
	}
	return charArr.join('');
}

function unicodePointToUtf8Bytes(ucp) {
	"use strict";
	var bytes;
	if (ucp <= 0x7F) {
		// 1 byte of the form 0xxxxxxx
		bytes = Uint8Array(1);
		bytes[0] = ucp;
	} else if (ucp <= 0x7FF) {
		// 2 bytes, the first one is 110xxxxx, and the last one is 10xxxxxx
		bytes = Uint8Array(2);
		bytes[1] = _1_FIRST_BITS + (ucp & _6_LAST_BITS);
		ucp >>= 6;
		bytes[0] = (ucp | _2_FIRST_BITS);
	} else if (ucp <= 0xFFFF) {
		// 3 bytes, the first one is 1110xxxx, and last 2 are 10xxxxxx
		bytes = Uint8Array(3);
		for (var i=2; i>0; i-=1) {
			bytes[i] = _1_FIRST_BITS +  (ucp & _6_LAST_BITS);
			ucp >>= 6;
		}
		bytes[0] = (ucp | _3_FIRST_BITS);
	} else if (ucp <= 0x10FFFF) {
		// 4 bytes, the first one is 11110xxx, and last 3 are 10xxxxxx
		bytes = Uint8Array(4);
		for (var i=3; i>0; i-=1) {
			bytes[i] = _1_FIRST_BITS + (ucp & _6_LAST_BITS);
			ucp >>= 6;
		}
		bytes[0] = (ucp | _4_FIRST_BITS);
	} else {
		throw new Error("Unicode char point is greater than 0x7FFFFFFF, which cannot be encoded into utf8.");
	}
	return bytes;
}

function encodeUtf8(str) {
	"use strict";
	var byteCounter = 0
		, charVocabulary = {}
		, ch, charBytes;
	for (var i=0; i<str.length; i+=1) {
		ch = str[i];
		charBytes = charVocabulary[ch];
		if ('undefined' === typeof charBytes) {
			charBytes = unicodePointToUtf8Bytes(ch.charCodeAt(0));
			charVocabulary[ch] = charBytes;
		}
		byteCounter += charBytes.length;
	}
	var allBytes = new Uint8Array(byteCounter);
	byteCounter = 0;
	for (var i=0; i<str.length; i+=1) {
		ch = str[i];
		charBytes = charVocabulary[ch];
		allBytes.set(charBytes, byteCounter);
		byteCounter += charBytes.length;
	}
	return allBytes;
}

/* Not very fancy test code for node

var testStr = "dsf;ijef щлоауцжадо 日本語";
var bytes = encodeUtf8(testStr);
var resStr = decodeUtf8(bytes);
console.log("Comparing intial string with decoded one ...");
if (testStr === resStr) {
	console.log("PASS: decoded string is the same as initial one");
} else {
	console.log("FAIL: initial string is\n"+testStr+"decoded one is\n"+resStr);
}
var buf = new Buffer(bytes);
var nodeReadStr = buf.toString('utf8');
console.log("Reading byte representation with node's own utf8 decoder ...");
if (nodeReadStr === testStr) {
	console.log("PASS: node reads bytes exactly");
} else {
	console.log("FAIL: initial string is\n"+testStr+"node decodes it as\n"+nodeReadStr);
}
 */

console.log(encodeUtf8("𝄞"));
