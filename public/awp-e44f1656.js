var REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

function validate(uuid) {
  return typeof uuid === 'string' && REGEX.test(uuid);
}

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */

var byteToHex = [];

for (var i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).substr(1));
}

function stringify(arr) {
  var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  var uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase(); // Consistency check for valid UUID.  If this throws, it's likely due to one
  // of the following:
  // - One or more input array values don't map to a hex octet (leading to
  // "undefined" in the uuid)
  // - Invalid input values for the RFC `version` or `variant` fields

  if (!validate(uuid)) {
    throw TypeError('Stringified UUID is invalid');
  }

  return uuid;
}

function parse(uuid) {
  if (!validate(uuid)) {
    throw TypeError('Invalid UUID');
  }

  var v;
  var arr = new Uint8Array(16); // Parse ########-....-....-....-............

  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  arr[1] = v >>> 16 & 0xff;
  arr[2] = v >>> 8 & 0xff;
  arr[3] = v & 0xff; // Parse ........-####-....-....-............

  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 0xff; // Parse ........-....-####-....-............

  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 0xff; // Parse ........-....-....-####-............

  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 0xff; // Parse ........-....-....-....-############
  // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)

  arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
  arr[11] = v / 0x100000000 & 0xff;
  arr[12] = v >>> 24 & 0xff;
  arr[13] = v >>> 16 & 0xff;
  arr[14] = v >>> 8 & 0xff;
  arr[15] = v & 0xff;
  return arr;
}

function stringToBytes(str) {
  str = unescape(encodeURIComponent(str)); // UTF8 escape

  var bytes = [];

  for (var i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }

  return bytes;
}

var DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
var URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
function v35 (name, version, hashfunc) {
  function generateUUID(value, namespace, buf, offset) {
    if (typeof value === 'string') {
      value = stringToBytes(value);
    }

    if (typeof namespace === 'string') {
      namespace = parse(namespace);
    }

    if (namespace.length !== 16) {
      throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
    } // Compute hash of namespace and value, Per 4.3
    // Future: Use spread syntax when supported on all platforms, e.g. `bytes =
    // hashfunc([...namespace, ... value])`


    var bytes = new Uint8Array(16 + value.length);
    bytes.set(namespace);
    bytes.set(value, namespace.length);
    bytes = hashfunc(bytes);
    bytes[6] = bytes[6] & 0x0f | version;
    bytes[8] = bytes[8] & 0x3f | 0x80;

    if (buf) {
      offset = offset || 0;

      for (var i = 0; i < 16; ++i) {
        buf[offset + i] = bytes[i];
      }

      return buf;
    }

    return stringify(bytes);
  } // Function#name is not settable on some platforms (#270)


  try {
    generateUUID.name = name; // eslint-disable-next-line no-empty
  } catch (err) {} // For CommonJS default export support


  generateUUID.DNS = DNS;
  generateUUID.URL = URL;
  return generateUUID;
}

/*
 * Browser-compatible JavaScript MD5
 *
 * Modification of JavaScript MD5
 * https://github.com/blueimp/JavaScript-MD5
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * https://opensource.org/licenses/MIT
 *
 * Based on
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */
function md5(bytes) {
  if (typeof bytes === 'string') {
    var msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = new Uint8Array(msg.length);

    for (var i = 0; i < msg.length; ++i) {
      bytes[i] = msg.charCodeAt(i);
    }
  }

  return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
}
/*
 * Convert an array of little-endian words to an array of bytes
 */


function md5ToHexEncodedArray(input) {
  var output = [];
  var length32 = input.length * 32;
  var hexTab = '0123456789abcdef';

  for (var i = 0; i < length32; i += 8) {
    var x = input[i >> 5] >>> i % 32 & 0xff;
    var hex = parseInt(hexTab.charAt(x >>> 4 & 0x0f) + hexTab.charAt(x & 0x0f), 16);
    output.push(hex);
  }

  return output;
}
/**
 * Calculate output length with padding and bit length
 */


function getOutputLength(inputLength8) {
  return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
}
/*
 * Calculate the MD5 of an array of little-endian words, and a bit length.
 */


function wordsToMd5(x, len) {
  /* append padding */
  x[len >> 5] |= 0x80 << len % 32;
  x[getOutputLength(len) - 1] = len;
  var a = 1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d = 271733878;

  for (var i = 0; i < x.length; i += 16) {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    a = md5ff(a, b, c, d, x[i], 7, -680876936);
    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, x[i], 20, -373897302);
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, x[i], 11, -358537222);
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = md5ii(a, b, c, d, x[i], 6, -198630844);
    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  return [a, b, c, d];
}
/*
 * Convert an array bytes to an array of little-endian words
 * Characters >255 have their high-byte silently ignored.
 */


function bytesToWords(input) {
  if (input.length === 0) {
    return [];
  }

  var length8 = input.length * 8;
  var output = new Uint32Array(getOutputLength(length8));

  for (var i = 0; i < length8; i += 8) {
    output[i >> 5] |= (input[i / 8] & 0xff) << i % 32;
  }

  return output;
}
/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */


function safeAdd(x, y) {
  var lsw = (x & 0xffff) + (y & 0xffff);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return msw << 16 | lsw & 0xffff;
}
/*
 * Bitwise rotate a 32-bit number to the left.
 */


function bitRotateLeft(num, cnt) {
  return num << cnt | num >>> 32 - cnt;
}
/*
 * These functions implement the four basic operations the algorithm uses.
 */


function md5cmn(q, a, b, x, s, t) {
  return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

function md5ff(a, b, c, d, x, s, t) {
  return md5cmn(b & c | ~b & d, a, b, x, s, t);
}

function md5gg(a, b, c, d, x, s, t) {
  return md5cmn(b & d | c & ~d, a, b, x, s, t);
}

function md5hh(a, b, c, d, x, s, t) {
  return md5cmn(b ^ c ^ d, a, b, x, s, t);
}

function md5ii(a, b, c, d, x, s, t) {
  return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}

v35('v3', 0x30, md5);

// Adapted from Chris Veness' SHA1 code at
// http://www.movable-type.co.uk/scripts/sha1.html
function f(s, x, y, z) {
  switch (s) {
    case 0:
      return x & y ^ ~x & z;

    case 1:
      return x ^ y ^ z;

    case 2:
      return x & y ^ x & z ^ y & z;

    case 3:
      return x ^ y ^ z;
  }
}

function ROTL(x, n) {
  return x << n | x >>> 32 - n;
}

function sha1(bytes) {
  var K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
  var H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

  if (typeof bytes === 'string') {
    var msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = [];

    for (var i = 0; i < msg.length; ++i) {
      bytes.push(msg.charCodeAt(i));
    }
  } else if (!Array.isArray(bytes)) {
    // Convert Array-like to Array
    bytes = Array.prototype.slice.call(bytes);
  }

  bytes.push(0x80);
  var l = bytes.length / 4 + 2;
  var N = Math.ceil(l / 16);
  var M = new Array(N);

  for (var _i = 0; _i < N; ++_i) {
    var arr = new Uint32Array(16);

    for (var j = 0; j < 16; ++j) {
      arr[j] = bytes[_i * 64 + j * 4] << 24 | bytes[_i * 64 + j * 4 + 1] << 16 | bytes[_i * 64 + j * 4 + 2] << 8 | bytes[_i * 64 + j * 4 + 3];
    }

    M[_i] = arr;
  }

  M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
  M[N - 1][14] = Math.floor(M[N - 1][14]);
  M[N - 1][15] = (bytes.length - 1) * 8 & 0xffffffff;

  for (var _i2 = 0; _i2 < N; ++_i2) {
    var W = new Uint32Array(80);

    for (var t = 0; t < 16; ++t) {
      W[t] = M[_i2][t];
    }

    for (var _t = 16; _t < 80; ++_t) {
      W[_t] = ROTL(W[_t - 3] ^ W[_t - 8] ^ W[_t - 14] ^ W[_t - 16], 1);
    }

    var a = H[0];
    var b = H[1];
    var c = H[2];
    var d = H[3];
    var e = H[4];

    for (var _t2 = 0; _t2 < 80; ++_t2) {
      var s = Math.floor(_t2 / 20);
      var T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[_t2] >>> 0;
      e = d;
      d = c;
      c = ROTL(b, 30) >>> 0;
      b = a;
      a = T;
    }

    H[0] = H[0] + a >>> 0;
    H[1] = H[1] + b >>> 0;
    H[2] = H[2] + c >>> 0;
    H[3] = H[3] + d >>> 0;
    H[4] = H[4] + e >>> 0;
  }

  return [H[0] >> 24 & 0xff, H[0] >> 16 & 0xff, H[0] >> 8 & 0xff, H[0] & 0xff, H[1] >> 24 & 0xff, H[1] >> 16 & 0xff, H[1] >> 8 & 0xff, H[1] & 0xff, H[2] >> 24 & 0xff, H[2] >> 16 & 0xff, H[2] >> 8 & 0xff, H[2] & 0xff, H[3] >> 24 & 0xff, H[3] >> 16 & 0xff, H[3] >> 8 & 0xff, H[3] & 0xff, H[4] >> 24 & 0xff, H[4] >> 16 & 0xff, H[4] >> 8 & 0xff, H[4] & 0xff];
}

v35('v5', 0x50, sha1);

class AWP extends AudioWorkletProcessor {

	constructor() { 
		
		super();

		this.port.onmessage = e => {
			
			if (e.data.playState){
				console.log(e.data.playState);
				this.Transport.updateState(e.data);
			}

			else if (e.data.snap){
				this.Transport.snap(e.data.snap);
				if (!this.Transport.isPlaying)
					this.Transport.snapSearch(this.Files);

			}

			else if (e.data.file){
				let id = this.Files.add(e.data.file, e.data.filename);
				this.port.postMessage({id: id});
			}

			else if (e.data.getWaveform != null){
				let response = null;
				if (e.data.getWaveform in this.Files.files){
					response = this.Files.files[e.data.getWaveform];
				}
				
				this.port.postMessage({setWaveform: response.waveform});
			}

			else if (e.data.clear){
				this.Transport.removeMetas(e.data.clear.clipId);
				this.Files.removeMeta(e.data.clear.fileId, e.data.clear.clipId);

			}

			else if (e.data.trims){
				
				let fileObj = this.Files.files[e.data.trims.fileId]; 
				
				//proceed with update if the file exists (it should)
				if (fileObj){ 

					let clipId = e.data.trims.clipId;
					let prevMeta = fileObj.metas[clipId]; //get previous meta for this clipID

					//prepare new meta
					let meta = e.data.trims.meta;
					meta.push(e.data.trims.clipId); //add clipId to meta
					meta.push(e.data.trims.fileId); //add fileId to meta
					meta.push(e.data.trims.trackId); //add trackId to meta

					if (!this.Tracks.tracks[e.data.trims.trackId]){
						console.log('Adding Ampliutude array');
						this.Tracks.tracks[e.data.trims.trackId] = {amplitude: this.Tracks.genertateAmplitudeArray()};
					}

					//new meta -- -- -- -- -- -- -- -- //
					//find this meta and replace it (if it exists) in 3 locations. Timeline, transport, files
					this.Transport.syncMetaObjects(meta, prevMeta);
					fileObj.metas[clipId] = meta;
					
				}

				
			}
		};
		
		this.Files = {

			files: {},
			NAMESPACE: 'd176d515-5974-40b9-b5c0-1b21800f1684',

			_generateWaveForm(audio, dType){

				// const scaler = (value, oldMin, oldMax, newMin, newMax) => {
				// 	return (newMax - newMin) * (value - oldMin	) / (oldMax - oldMin) + newMin
				// }
				
				// const typeRanges = {
				// 	'int16': [-32768, 32767]
				// }

				let density = 600; //has to be density % numChannels = 0 --> this means next chunk always starts on a L sample if we index starting at 0 (and we are interleaved)
				//const height = 4000; //this is in pixels and is arbitrary since varying track heights will stretch and squash whatever the instrinsic height actually is. There is prob a sane default here
            	const channels = 2;

				let points = [];
				let x = 0;

				for (let i=0; i < audio.length; i += density){ 
					points.push([x, audio[i], 0]);
					x++;        
				}
			
				const result = {
					points: points,
					sampleLength: audio.length,
					// height: height,
					density: density,
					channels: channels,

				};

				return result
			},

			removeMeta(fileId, clipId){
				let fileObj = this.files[fileId];
				if (fileObj){
					fileObj.metas[clipId] ? 
					delete fileObj.metas[clipId] : 
					console.error('Clip Id Not Found In Files.files');
				}
				
				console.log(this.files);
			},


			//https://github.com/pierrec/js-xxhash try this to create a hash
			add(audioBuffer, filename){
				
				// let fileId = uuidv5(filename, this.NAMESPACE)
				let fileId = 'opwepwe';

				if (fileId in this.files){
					console.warn('File already in the bin');
					return fileId
				}
				
				else {
					
					//use wav parser util to check data type
					const audio = new Int16Array(audioBuffer.slice(44, audioBuffer.byteLength)); //int16 only for now
					const waveform = this._generateWaveForm(audio, 'int16');

					this.files[fileId] = {
						audio: audio,
						waveform: waveform,
						metas: {}, // {clipId: [start, leftTrim, rightTrim, clipId, fileId]} // how to be less redundant here
						playbackOffset: 0,
					};
					
					console.log(filename, fileId);
					return fileId

				}
			}

		};

		this.Tracks = {

			genertateAmplitudeArray(){
				return new Float32Array(128)
			},

			tracks: {} 
		};

		this.Transport = {
			
			isPlaying: false,
			frameNumber: 0,
			timeline: {},
			stack: [],

			tick(frames){ this.frameNumber += frames; },
			snap(frameNumber){ this.frameNumber = frameNumber;},

			clearStack(){
				this.stack = [];
				console.log('Cleared Transport Stack');
			},

			updateState(updateObj){
				
				if(updateObj.playState === 'play') 
					this.isPlaying = true;
				else {
					this.isPlaying = false;
					this.snap(updateObj.startPos);
					//this.clearStack();
					
				}				
			},

			//check if current transport position overlaps any entries in the timeline object - if so,
			//add to the transport stack
			snapSearch(Files){
				for (const entry in this.timeline){
					for (const [i, m] of this.timeline[entry].entries()){
						let fileObj = Files.files[m[4]];
						let channels = fileObj.waveform.channels;
						if (this.frameNumber > m[0] && this.frameNumber < (fileObj.audio.length / channels) - m[2]){
							
							//see if it already exists in the transport stack, if not, add it
							for (const stackMeta of this.stack) {
								if (m[3] === stackMeta[3]){
									console.log('Already on the stack');
									return;
								}
							}

							console.log('Adding to stack');
							this.stack.push(m);

						}
					
					}

				}
			},

			removeMetas(clipId){
				
				for (const slot in this.timeline) {
					let metas = this.timeline[slot];
					for (const [i, m] of metas.entries()){
						if (m[3] === clipId){
							metas.splice(i, 1);
							console.log('Deleted clip removed from timeline slot(s)');
						}
					}
				}

				for (const [i, m] of this.stack.entries()){
					if (m[3] === clipId){
						this.stack.splice(i, 1);
						console.log('Deleted clip removed from transport stack');
					}
				}
			},

			syncMetaObjects(meta, prevMeta) {

				//if the meta is on the transport stack, update it
				for (const [i, m] of this.stack.entries()){
					if (m[3] === meta[3]){
						//console.log('Updating Existing Transport Stack Entry')
						this.stack[i] = meta;
					}
				}


				//get the prev timeline slot of this meta (if there is one) and remove it from there
				if (prevMeta){
					let prevSlot = prevMeta[0] - (prevMeta[0] % 128);
					let slotMetas = this.timeline[prevSlot];
					if (slotMetas){
						for (const [i, m] of slotMetas.entries()){
							if (m[3] === meta[3]) { //if clipIds match
								slotMetas.splice(i, 1); //remove the old meta entry
								if (slotMetas.length <= 0) // if there are no more metas in this timeline slot, remove the slot
									delete this.timeline[prevSlot];
							}
						}
					}
				}
				
				

				//add to the new timeline slot or create a new slot if needed
				let slot = meta[0] - (meta[0] % 128);
				if (this.timeline[slot]){ //the needed slot already exists, check if this meta already exists there (redundant probably)
					for (const [i, m] of this.timeline[slot].entries()){
						if (m[3] === meta[3]) { //this should never happen if the above worked
							console.log('Updating Timeline Slot');
							this.timeline[slot][i] = meta;
							return
						}
					}
				
					this.timeline[slot].push(meta); // the meta doesn't exist so add it to this slot
				
				}

				else {
					this.timeline[slot] = [meta]; //the slot never existed so create it and add the meta
				}
				
				//if playhead position is currently ahead of start time and it's not already there
				//add this to the transport stack
				if (this.frameNumber >= meta[0]){
					for (const [i, m] of this.stack.entries()){
						if (m[3] === meta[3]){ return }
					}

					console.log('Back adding to tranport stack');
					this.stack.push(meta);
				}
			}
		};

	}


	//trackObject

	//each tick advances 128 frames when playback is started
	process (inputs, outputs, parameters) {
		
		let outputDevice = outputs[0];
		let frames = outputDevice[0].length;

		if (this.Transport.isPlaying){			
			
			let P = this.Transport.frameNumber;
			let metas = this.Transport.timeline[P];
			if (metas){
				metas.forEach(meta => this.Transport.stack.push(meta));
			}

			if (this.Transport.stack.length > 0){

				//run through 0 to 127
				for (let frame = 0; frame < frames; frame++){	

					P = this.Transport.frameNumber + frame;


					for (const [index, meta] of this.Transport.stack.entries()){
					
						let fileObj = this.Files.files[meta[4]];
						let idx = P - meta[0];
						let ampliArray = this.Tracks.tracks[meta[5]].amplitude;
						ampliArray[frame] = 0; //clear any previous amplitude

						if (idx >= 0) {
						
							let channels = fileObj.waveform.channels;
							idx += meta[1];

							if (idx > ((fileObj.audio.length / channels) - meta[2])){
								console.log('Item removed from transport stack');
								this.Transport.stack.splice(index, 1);
								continue;
							}
							
							
							for (let ch = 0; ch < channels; ch++){
								idx += ch;          
								let sample = fileObj.audio[idx * channels] / 32768; //scale the value of idx to +/- playback speed
								
								if (ch === 0){
									let sq = sample * sample;
									ampliArray[0] += sq;
								}
								
								// if (sample > 0.99 || sample < -0.99){
								// 	console.log(sample)
								// }

								//this is for summing all tracks, but fails when we move clips around
								let prevValue = outputDevice[ch][frame];
								sample += prevValue;
								
								sample > 1.0 ? sample = 1.0 : sample = sample;
								sample < -1.0 ? sample = -1.0 : sample = sample;

								outputDevice[ch][frame] = sample;
							}

						
						}

					}

				}


				//for (const track in this.Tracks.tracks){
				//	let amp = this.Tracks.tracks[track].amplitude[0]
				//	let rms = Math.sqrt((1/128) * amp);
					//this.port.postMessage({amplitude: {track: track, amplitude: rms}})
				//}
			
			}
			
			this.Transport.tick(frames);
			//this.port.postMessage({tick: this.Transport.frameNumber})
		}


		return true
	}
}
  
  registerProcessor('awp', AWP);

















//check for any metas for this clip id that already exist
					//find the timeline slot it currently occupies and remove it from there
					//let prevMeta = fileObj.metas[clipId]
					// if (prevMeta){
					// 	let prevSlot = prevMeta[0] - (prevMeta[0] % 128)
						
					// 	delete this.Files.timeline[prevSlot]
					// }

					//update fileObj - do we still need this structure as it is?
					//fileObj.metas[clipId] = meta
									
					//check the transport stack for this meta
					// for (const [i, m] of this.Transport.stack.entries()){
					// 	if (m[3] === clipId) {
					// 		console.log('Replacing Transport Slot')
					// 		this.Transport.stack[i] = meta
					// 	}
					// }

					//calculate new slot
					//let slot = fileObj.metas[clipId][0] - (fileObj.metas[clipId][0] % 128)
					
					//if slot already exists - check attached metas and see if any match our clipID
					//meta: --> [start, leftTrim, rightTrim, clipId, fileID]
					//if (this.Files.timeline[slot]){
						
						// for (const [i, m] of this.Files.timeline[slot].entries()){
						// 	if (m[3] === clipId) {
						// 		console.log('Replacing Timeline Slot')
						// 		this.Files.timeline[slot][i] = meta
						// 		return
						// 	}
						// }

						//if this clip is new to this slot, just add it
						//this.Files.timeline[slot].push(meta)
					//}

					//else {

						//if the slot doesn't exist -- create it and add the meta
						//this.Files.timeline[slot] = [fileObj.metas[clipId]]
					//}
//# sourceMappingURL=awp-e44f1656.js.map
