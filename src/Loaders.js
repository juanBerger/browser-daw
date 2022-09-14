import { userEvents } from './stores.js'
import { AudioCore } from './audio-utils.js'

export const Loaders = {

    auto() {

        const files = [
            "test_1.wav",
            "TRL_TRL_0128_01401_Wonder__a__APM.wav"
        ]

        for (const file of files){

            const req = new XMLHttpRequest();
            req.open("GET", file, true);
            req.responseType = "arraybuffer";
            req.send();
            req.onload = async e => {
                const audioBuffer = req.response;
                this._parseResponse(audioBuffer, file);
            }

        }
    },

    async filePicker() {

        const [handle] = await window.showOpenFilePicker({
            types: [{ description: '16 bit .wav file', accept: {'application/octet-stream': ['.wav']}}],
            startIn: 'desktop'}) 
        const file = await handle.getFile();
        const audioBuffer = await file.arrayBuffer();
        this._parseResponse(audioBuffer, file);
        
    },

    //This defines how we react to each new audioBuffer
    async _parseResponse(audioBuffer, file){
        const fileId = await AudioCore.addFile(audioBuffer, file.split('.wav')[0]);
        userEvents.update(ue => {
            ue.push({type: 'addTrack', clips: [{fileId: fileId, start: 0, trims: [0, 0]}, ]})
            return ue
        })    

    }

}