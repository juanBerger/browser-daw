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

var v5 = v35('v5', 0x50, sha1);

function _wavParser (byteView) {
				
    //console.log(String.fromCharCode(...byteView.slice(0, 4))) 
    const ch = byteView.slice(22, 24)[0];
    const sr = new Int32Array(byteView.buffer.slice(24, 28))[0];
    const dtype = byteView.slice(34, 36)[0];

    
    let isSearching = true;
    const chunkInfo = {ch: ch, sr: sr, dtype: dtype, dataStart: null, dataEnd: null};
    let idx = 36;
    let count = 0;

    while(isSearching){

        if (count > 300){ //loop till eof instead
            console.error('No data chunk found!');
            isSearching = false;
        }

        let endIdx = idx + 4;
        const chunkType = String.fromCharCode(...byteView.slice(idx, endIdx));
        const chunkSize = new Int32Array(byteView.buffer.slice(endIdx, endIdx + 4))[0];
        
        //console.log('[FOUND CHUNK TYPE: ', chunkType)
        
        if (chunkType === 'data'){
            isSearching = false;
            chunkInfo.dataStart = endIdx + 4;
            chunkInfo.dataEnd = chunkInfo.dataStart + chunkSize;
        }

        idx = endIdx + 4 + chunkSize;
        count++;
    }

    return chunkInfo

}


function _generateWaveForm(audio, dType){

    const scaler = (value, oldMin, oldMax, newMin, newMax) => {
        return (newMax - newMin) * (value - oldMin	) / (oldMax - oldMin) + newMin
    };
    
    const typeRanges = {
        'int16': [-32768, 32767]
    };

    let density = 200; //has to be density % numChannels = 0 --> this means next chunk always starts on a L sample if we index starting at 0 (and we are interleaved)
    const height = 2000; //this is in pixels and is arbitrary since varying track heights will stretch and squash whatever the instrinsic height actually is. There is prob a sane default here
    const channels = 2;

    let points = [];
    let x = 0;

    for (let i=0; i < audio.length; i += density){ 
        let scaled = Math.round(scaler(audio[i], typeRanges[dType][0], typeRanges[dType][1], 0, height));
        points.push(String(x) + ',' + String(scaled));
        x++;        
    }

    const result = {
        points: points,
        sampleLength: audio.length,
        height: height,
        density: density,
        channels: channels,

    };

    return result
}

function _castToFloat(audio){

    const floatAudio = new Float32Array(audio.length);
    for (let i = 0; i < floatAudio.length; i++){
        floatAudio[i] = audio[i] / 32768;
    }

    return floatAudio;
}

class AWP extends AudioWorkletProcessor {

	constructor() { 
		
		super();
		
		this.canvasPort;
		this.tickBuffer = 10;
		this.wasPlaying = false;

		this.port.onmessage = e => {
			
			if (e.data.playToggle){

				this.Transport.isPlaying = !this.Transport.isPlaying;
				//this.Transport.fpp = e.data.fpp;
			}

			else if (e.data.uiUpdate){
				this.Transport.syncStackOnUpdate(e.data.uiUpdate);
				this.Transport.timeLine.syncOnUpdate(e.data.uiUpdate);
			}

			else if (e.data.fppUpdate){
				this.Transport.fpp = e.data.fppUpdate;
			}

			else if (e.data.file){
				const id = this.Files.add(e.data.file, e.data.filename);
				this.port.postMessage({id: id});
			}

			else if (e.data.addTrack >= 0){
				this.Tracks.add(e.data.addTrack);
			}

			else if (e.data.getWaveform != null){
				let response = null;
				if (e.data.getWaveform in this.Files.files){
					response = this.Files.files[e.data.getWaveform];
				}
				
				this.port.postMessage({setWaveform: response.waveform});
			}


			else if (e.data.clear){
				this.Transport.clearFromStack(e.data.clear.clipId);
				this.Transport.timeLine.clear(e.data.clear.clipId, true);

			}

			else if (e.data.canvasPort){
				this.canvasPort = e.data.canvasPort;	
			}

			else if (e.data.resize){
				this.canvasPort.postMessage(e.data);
			}

			else if (e.data.snap){
				this.Transport.snap(e.data.snap);
				this.canvasPort.postMessage({tick: this.Transport.frameNumber, fpp: this.Transport.fpp});
			}

		};
		
		this.Files = {

			files: {},
			NAMESPACE: 'd176d515-5974-40b9-b5c0-1b21800f1684',

			add(audioBuffer , filename){
				
				let fileId = v5(filename, this.NAMESPACE);

				if (fileId in this.files){
					console.warn('File already in the bin');
					return fileId
				}
				
				else {
					
					//use wav parser util to check data type
					const byteView = new Uint8Array(audioBuffer);
					const parsedHeader = _wavParser(byteView);
					const audio = new Int16Array(byteView.buffer.slice(parsedHeader.dataStart, parsedHeader.dataEnd));
					const waveform = _generateWaveForm(audio, 'int16');
					const floatAudio = _castToFloat(audio);


					this.files[fileId] = {
						audio: floatAudio,
						waveform: waveform, //{points: [points], sampleLength: len, height: height, density: density, channels: channels}
						playbackOffset: 0,
					};
					
					//console.log(filename, fileId)
					return fileId

				}
			}

		};

		this.Tracks = {
			
			tracks: {}, 
			
			add(trackId){
				
				const newTrack = {
					
					// left: new Float32Array(128),
					// right: new Float32Array(128), 
					gain: 1,
					muted: false
				};
				
				this.tracks[trackId] = newTrack;

			}
		
		};

		this.Transport = {
			
			isPlaying: false,
			fpp: 0,
			frameNumber: 0,
			timeLine: {
				
				 //'foreign keys' --> startSlot: clipId / endSlot: clipId. This allows looking up clipIds by time slot. 
				 //you can then get the uiUpdate object with data[clipId]
				maps: {},
				
				syncOnUpdate (uiUpdate){
												
					let prev = this.data[uiUpdate.clipId];
					
					if (prev){
						
						const pSslot = prev.start - (prev.start % 128);
						const pEslot = prev.end - (prev.end % 128);
						const startList = this.maps[pSslot];
						const endList = this.maps[pEslot];
						
						if (startList){
							startList.forEach((uiUp, i) => {
								if (uiUp.id === prev.clipId)
									startList.splice(i, 1);
							});
						
							if (startList.length <= 0)
								delete this.maps[pSslot];
						}


						if (endList){
							endList.forEach((uiUp, i) => {
								if (uiUp.id === prev.clipId)
									endList.splice(i, 1);
							});
						
							if (endList.length <= 0){
								delete this.maps[pEslot];
							}
						}

					}


					const start = uiUpdate.start;
					const startSlot = start - (start % 128);
					const startList = this.maps[startSlot];
					const startUpdate = {id: uiUpdate.clipId, type: 'start'};

					if (!startList){
						this.maps[startSlot] = [startUpdate];
					}
					
					else {
						startList.push(startUpdate);
					}

					const end = uiUpdate.end;
					const endSlot = end - (end % 128);
					const endList = this.maps[endSlot];
					const endUpdate = {id: uiUpdate.clipId, type: 'end'};
					if (!endList){
						this.maps[endSlot] = [endUpdate];
					}

					else {
						endList.push(endUpdate);
					}

					this.data[uiUpdate.clipId] = uiUpdate;
					//console.log('xxxxx MAPS xxxxx', this.maps);
				},

				clear(clipId){

					let prev = this.data[clipId];
					
					if (prev){
						const pSslot = prev.start - (prev.start % 128);
						const pEslot = prev.end - (prev.end % 128);
						delete this.maps[pSslot];
						delete this.maps[pEslot];
						delete this.data[clipId];
					}

				},


				//clipId: {uiUpdate}
				data: {} 

			},

			stack: [],
			overlapStack: [],

			clearFromStack(clipId){
				
				for (const [i, s] of this.stack.entries()){
					if (s.clipId === clipId){
						this.stack.splice(i, 1);
						console.log('[Clearing From Stack On Deletion]...', clipId);
					}
				}

				
			},


			syncStackOnUpdate(uiUpdate){
				
				for (const [i, s] of this.stack.entries()){
					if (s.clipId === uiUpdate.clipId){
						console.log('[Removing From Stack On Update]...', uiUpdate.clipId);
						this.stack.splice(i, 1);
					}
				}

				if (this.frameNumber  > uiUpdate.start && this.frameNumber < uiUpdate.end){
					console.log('[Adding To Stack On Update]...', uiUpdate.clipId);
					this.stack.push(uiUpdate);
				}
			},


			syncMapsOnSnap(){

				this.overlapStack = [];
				
				for (const clipId in this.timeLine.data){
					const clip = this.timeLine.data[clipId];
					
					if (this.frameNumber > clip.start && this.frameNumber < clip.end){
						this.overlapStack.push(clip);

						// if (!this.timeLine.maps[this.frameNumber]){
						// 	let slotArray = [];
						// 	slotArray.push(slotObject);
						// 	this.timeLine.maps[this.frameNumber] = slotArray;
						// }

						// else {
							
						// 	for (const so of this.timeLine.maps[this.frameNumber]){
						// 		if (so.id === slotObject.id)
						// 			continue;
						// 		this.timeLine.maps[this.frameNumber].push(slotObject);
						// 	}
							
						// }
					}
				}

			},

			syncStackOnBoundries(){

				const tlObjects = this.timeLine.maps[this.frameNumber];
				
				if (tlObjects){
					
					tlObjects.forEach((tlObject, i) => {

						const uiUpdate = this.timeLine.data[tlObject.id];
						
						if (tlObject.type === 'start'){
							this.stack.push(uiUpdate);
							console.log('[Adding To Stack On Boundry]...', uiUpdate.clipId);
						}

						else if (tlObject.type === 'overlap'){
							this.overlapStack.push(uiUpdate);
							console.log('[Adding To Stack On Overlap]...', uiUpdate.clipId);
						}

						else {
		
							this.stack.forEach((s, i) => {
								if (s.clipId === uiUpdate.clipId){
									this.stack.splice(i, 1);
									console.log('[Removing From Stack On Boundry]...', uiUpdate.clipId);
								}
							});	
						}

					});

				}

				// else {

				// 	for (const clipId in this.timeLine.data){
				// 		const uiUpdate = this.timeLine.data[clipId];
				// 		const clipStart = uiUpdate.start;
				// 		const clipEnd = uiUpdate.end;
				// 		if (this.frameNumber > clipStart && this.frameNumber < clipEnd){
				// 			for (const _uiUpdate of this.stack){
				// 				if (_uiUpdate.clipId === uiUpdate.clipId)
				// 					break
				// 			}
							
				// 			this.stack.push(uiUpdate);
				// 			console.log('[Adding To Stack On Overlap]...', uiUpdate.clipId);
				// 		}
				// 	}
				// }

			},

	
			tick(frames){ this.frameNumber += frames; },
			
			snap(frameNumber){ 
				this.frameNumber = frameNumber;
				this.syncMapsOnSnap();
			},

			//on playback stop
			clearStack(){
				this.stack = []; //consider keeping pointers or something for this....
				console.log('Cleared Transport Stack');
			},

		};
	}


	//during playback --> check if current frameNumber corresponds to add or remove from stack
	//on uiUpdae --> for each update object check if the clipId exists on the stack, if so remove it
	//on uiUpdate --> for each update object, check if the current frameNumber is between start and stop, 
	// 					if it is and the uiObject is not already on the stack, add it

	//each tick advances 128 frames when playback is started
	process (inputs, outputs, parameters) {
		
		if (this.Transport.isPlaying){			

			this.Transport.syncStackOnBoundries();
			
			let P = this.Transport.frameNumber;
			const channels = 2;
			const outputDevice = outputs[0];
			const outputL = outputDevice[0];
			const outputR = outputDevice[1];
			const frames = outputDevice[0].length;
			const stack = this.Transport.stack.concat(this.Transport.overlapStack);
		
			const tracks = this.Tracks.tracks; //tracks: {trackId: {left: [typedArray], right: [typedArray], gain: number, muted: false}}

			//{start: start, end: end, trims: [trims], fileId: fileId, trackId: trackId}
			for (let i = 0; i < stack.length; i++){
				
				const entry = stack[i];
				const fileObj = this.Files.files[entry.fileId];
				const start = (entry.trims[0] + (P - entry.start)) * channels;
				const end = start + (frames * channels);
				
				
				const slice = fileObj.audio.subarray(start, end); //this should be 128 *  channels length

				// const offset = frames - (end - start); ////need this offset in case our slice does not fill a full 128 samples.
				// const trackL = tracks[entry.trackId].left;
				// const trackR = tracks[entry.trackId].right;

				const gain = tracks[entry.trackId].gain;
				
				for (let s = 0, frame = 0; s < slice.length; s++){
					if (s % 2 === 0){
						outputL[frame] += slice[s] * gain;
					}
						
					else {
						outputR[frame] += slice[s] * gain;
						frame++;
					}
				}

			}

			//only call this every x chunks?
			if (this.tickBuffer >= 1){
				this.tickBuffer = 0;
				this.canvasPort.postMessage({tick: this.Transport.frameNumber, fpp: this.Transport.fpp}); //add computed RMS vlues for each channel for each track
			}

			//this.Transport.overlapStack = [];
			this.Transport.tick(frames);
			this.tickBuffer++;
			this.wasPlaying = true;
		}

		else if (this.wasPlaying){
			this.wasPlaying = false;
			//this.Transport.clearStack();
		}


		return true
	}
}
  
  registerProcessor('awp', AWP);
//# sourceMappingURL=awp-6845743e.js.map