import { lineDataStore, userEvents } from './stores.js'
import { AudioCore } from './audio-utils.js'

export const Loaders = {

    count: -1,
    audioBuffers: [],

    async groupParse(){

        for (const item of this.audioBuffers){
            let result = await this._parseResponse(item[0], item[1])
            console.log(result)
        }

    },

    auto() {

        const loadInterval = setInterval(() => {
            if (this.audioBuffers.length === files.length){
                clearInterval(loadInterval)
                this.groupParse();
            }

        }, 2)

        const files = [
            //"test_1.wav",
            // "TRL_TRL_0128_01401_Wonder__a__APM.wav"
            'SCOR_SCORE_0218_02701_Roll_Out_The_Bank__a__30_STEM_(808)_APM.wav',
            // 'SCOR_SCORE_0218_02701_Roll_Out_The_Bank__a__30_STEM_(HOOK)_APM.wav',
            'SCOR_SCORE_0218_02701_Roll_Out_The_Bank__a__30_STEM_(MELODY)_APM.wav',
            'SCOR_SCORE_0218_02701_Roll_Out_The_Bank__a__30_STEM_(MONEY_GUN)_APM.wav',
            'SCOR_SCORE_0218_02701_Roll_Out_The_Bank__a__30_STEM_(PERC)_APM.wav',
            // 'SCOR_SCORE_0218_02701_Roll_Out_The_Bank__a__30_STEM_(VERSE)_APM.wav'
        ]

        for (const file of files){
            const req = new XMLHttpRequest();
            req.open("GET", file, true);
            req.responseType = "arraybuffer";
            req.send();
            req.onload = async e => {
                console.log(file)
                const audioBuffer = req.response;
                this.audioBuffers.push([audioBuffer, file])
                //let result = await this._parseResponse(audioBuffer, file);
                //console.log('Passed Parse', result)
            }

        }
    },

    async filePicker() {

        const [handle] = await window.showOpenFilePicker({
            types: [{ description: '16 bit .wav file', accept: {'application/octet-stream': ['.wav']}}],
            startIn: 'desktop'}) 
        const file = await handle.getFile();
        const audioBuffer = await file.arrayBuffer();
        await this._parseResponse(audioBuffer, file);
        
    },

    //This defines how we react to each new audioBuffer
    async _parseResponse(audioBuffer, file){
        
        return new Promise(async (resolve, reject) => {

            const fileId = await AudioCore.addFile(audioBuffer, file.split('.wav')[0]);
            const lineData = await AudioCore.getWaveform(fileId);
        
            //we need to keep a copy of this on the ui thread so that creating new clips is not async
            lineDataStore.update(lds => {
                lds[fileId] = lineData
                return lds
            })

            userEvents.update(ue => {
                ue.push({type: 'addTrack', clips: [{fileId: fileId, start: 0, trims: [0, 0]}, ]})
                return ue
            })   

            resolve(true)

        });

    }

}