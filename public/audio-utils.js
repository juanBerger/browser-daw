import awpURL from 'omt:./awp.js'
import canvasURL from 'omt:./canvas.js'


export const CanvasCore = {

    worker: null,

    create(){
        this.worker = new SharedWorker(canvasURL, {name: 'Canvas Worker'})
        return this.worker;
    }
}


export const AudioCore = {

    audioContext: null,
    awp: null,
    totalSamples: 0,
    onMessageCallbacks: [],
    addFileResult: -1,
    getWaveFormResult: -1,
    getAddTrackResult: -1,

    registerCallback(callback){
        this.onMessageCallbacks.push(callback)
    },

    initOnMessage(){
        this.awp.port.onmessage = e => {
            
            //special cases
            if (e.data.id){
                this.addFileResult = e.data.id;
                return
            }

            else if (e.data.addTrack){
                this.getAddTrackResult = e.data.addTrack;
                return
            }

            else if (e.data.setWaveform){
                this.getWaveFormResult = e.data.setWaveform;
                return
            }
            
            this.onMessageCallbacks.forEach(cb => cb(e))
        }
    },

    async addFile (arrayBuffer, filename) {
        
        return new Promise((resolve, reject) => {
            
            const interval = setInterval(() => {
                
                if(this.addFileResult !== -1){
                    clearInterval(interval);
                    let result = this.addFileResult
                    this.addFileResult = - 1;
                    result !== null ? resolve(result) : reject(result);
                }
            
            }, 3)
            
            this.awp.port.postMessage({file: arrayBuffer, filename: filename}, [arrayBuffer])
        })
    },


    async getWaveform (id){
        
        return new Promise((resolve, reject) => {
            
            const interval = setInterval(() => {
    
                if(this.getWaveFormResult !== -1){
                    clearInterval(interval);
                    let result = this.getWaveFormResult;
                    this.getWaveFormResult = -1;
                    result !== null ? resolve(result) : reject(result);
                }
            
            }, 3)
            
        
            this.awp.port.postMessage({getWaveform: id})
            
        })

    },


    addTrack (id){

        return new Promise((resolve, reject) => {
            
            const interval = setInterval(() => {
    
                if(this.getAddTrackResult !== -1){
                    clearInterval(interval);
                    let result = this.getAddTrackResult;
                    this.getAddTrackResult = -1;
                    result !== null ? resolve(result) : reject(result);
                }
            
            }, 3)
            
        
            this.awp.port.postMessage({addTrack: id})
            
        })

    },

    async create() {

        this.audioContext = new AudioContext({latencyHint: 0, sampleRate: 48000});
        await this.audioContext.audioWorklet.addModule(awpURL)
        this.awp = new AudioWorkletNode(this.audioContext, 'awp', {numberOfInputs: [1], numberOfOutputs: [1], outputChannelCount: [2]});
        this.awp.connect(this.audioContext.destination);
        console.log('Created Audio Context: ', this.audioContext);
        this.initOnMessage();
        return Promise.resolve();
    }


}


export function convolve(inline){
    let x = [0, 1.3, 3.3, 4.5, 6.6, 23]
    let h = [1, 1, 0.6, 2]

    if (inline){
        let y = Array(x.length + h.length - 1).fill(0)
        for (let i=0; i < x.length; i++){
            for (let j=0; j < h.length; j++){
                y[i + j] += x[i] * h[j]
            } 
        }

        return y
    }
    
    else {
        let outputs = []
        for (let i=0; i < x.length; i++){
            let output = Array(x.length + h.length - 1).fill(0)
            for (let j=0; j < h.length; j++){
                output[i + j] += x[i] * h[j]
            }
            
            outputs.push(output)
        }

        return outputs
    }

}