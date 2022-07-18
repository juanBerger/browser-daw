//(span of new range * real current delta / span of old range) + newRange
export const scaler = (value, oldMin, oldMax, newMin, newMax) => {
    return (newMax - newMin) * (value - oldMin) / (oldMax - oldMin) + newMin
}

//2 byte ints are 1 Uint8 digit per byte?
//http://www.topherlee.com/software/pcm-tut-wavformat.htmlx
export const wavParser = (header) => {
    //console.log(String.fromCharCode(...new Uint8Array(header.slice(0, 4))))
    const ch = new Uint8Array(header.slice(22, 24))[0]
    const sr = new Int32Array(header.slice(24, 28))[0]
    const dtype = new Uint8Array(header.slice(34, 36))[0]
    return {ch: ch, sr: sr, dtype: dtype}
}