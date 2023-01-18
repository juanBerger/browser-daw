export function _wavParser (byteView) {
				
    //console.log(String.fromCharCode(...byteView.slice(0, 4))) 
    const ch = byteView.slice(22, 24)[0]
    const sr = new Int32Array(byteView.buffer.slice(24, 28))[0]
    const dtype = byteView.slice(34, 36)[0]

    
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
        const chunkType = String.fromCharCode(...byteView.slice(idx, endIdx))
        const chunkSize = new Int32Array(byteView.buffer.slice(endIdx, endIdx + 4))[0]
        
        //console.log('[FOUND CHUNK TYPE: ', chunkType)
        
        if (chunkType === 'data'){
            isSearching = false
            chunkInfo.dataStart = endIdx + 4;
            chunkInfo.dataEnd = chunkInfo.dataStart + chunkSize;
        }

        idx = endIdx + 4 + chunkSize
        count++;
    }

    return chunkInfo

}


export function _generateWaveForm(audio, dType){

    const scaler = (value, oldMin, oldMax, newMin, newMax) => {
        return (newMax - newMin) * (value - oldMin	) / (oldMax - oldMin) + newMin
    }
    
    const typeRanges = {
        'int16': [-32768, 32767]
    }

    let density = 200; //has to be density % numChannels = 0 --> this means next chunk always starts on a L sample if we index starting at 0 (and we are interleaved)
    const height = 2000; //this is in pixels and is arbitrary since varying track heights will stretch and squash whatever the instrinsic height actually is. There is prob a sane default here
    const channels = 2;

    let points = [];
    let x = 0;

    for (let i=0; i < audio.length; i += density){ 
        let scaled = Math.round(scaler(audio[i], typeRanges[dType][0], typeRanges[dType][1], 0, height))
        points.push(String(x) + ',' + String(scaled))
        x++        
    }

    const result = {
        points: points,
        sampleLength: audio.length,
        height: height,
        density: density,
        channels: channels,

    }

    return result
}

export function _castToFloat(audio){

    const floatAudio = new Float32Array(audio.length);
    for (let i = 0; i < floatAudio.length; i++){
        floatAudio[i] = audio[i] / 32768;
    }

    return floatAudio;
}