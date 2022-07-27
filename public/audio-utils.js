

export const AudioCore = {

    audioContext: null,
    awp: null,
    totalSamples: 0,

    //move this to AudioCore
    addFile (arrayBuffer, filename) {
        return new Promise((resolve, reject) => {
            this.awp.port.onmessage = e => {
                if (e.data.id != null) resolve(e.data.id)
                else reject(null)
            }
            
            this.awp.port.postMessage({file: arrayBuffer, filename: filename}, [arrayBuffer])
        })
    },

    //re
    getWaveform (id){
        return new Promise((resolve, reject) => {
            this.awp.port.onmessage = e => {
                if (e.data.setWaveform != null) resolve(e.data.setWaveform)
                else reject(null)
            }
            this.awp.port.postMessage({getWaveform: id})
            
        })

    },

    addClips (){

    },

    async create() {

        this.audioContext = new AudioContext({latencyHint: 0, sampleRate: 48000});
        await this.audioContext.audioWorklet.addModule('./awp.js')
        this.awp = new AudioWorkletNode(this.audioContext, 'awp', {numberOfInputs: [1], numberOfOutputs: [1], outputChannelCount: [2]});
        this.awp.connect(this.audioContext.destination)
        console.log('Created Audio Context: ', this.audioContext)
        return Promise.resolve()
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