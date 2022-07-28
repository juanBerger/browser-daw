import './styles.css'
import TrackArea from './TrackArea.svelte'

import {convolve} from './audio-utils.js'


window.onload = e => {

    console.log(convolve(false))
    const app = document.getElementById('app')
    const trackArea = new TrackArea({target: app})

  

}






//This is for a file dialogue
// const readFile = async () => {
//     const [handle] = await window.showOpenFilePicker({
//         types: [{ description: 'Pro Tools Session Files', accept: {'application/octet-stream': ['.wav']}}],
//         startIn: 'desktop'}) 
//     const file = await handle.getFile()
//     const buffer = await file.arrayBuffer()
//     return buffer
// }


// -- OLD -- OLD -- //


// window.onclick = async e => {
    
//     //ha ha 
//     if (tracks.length > 0)
//         return
    
//     const track = document.createElement('div')
//     track.id = 'track_' + String(tracks.length)
//     track.className = 'track'
//     const audioBuffer = await readFile()
//     let audioMeta = wavParser(audioBuffer.slice(0, 44))

//     //track can be already existing
//     const clip = new Clip({target: track, 
//         props: {
//             audioBuffer: audioBuffer,
//             audioMeta: audioMeta,
//             zoomLevel: 0
//         }
//     })

//     const trackArea = document.getElementById('trackArea')
//     trackArea.appendChild(track)
//     tracks.push(track)
// }

     
// point.setAttribute('cy', String(lastY))
// point.setAttribute('cx', String(scaled))
// point.setAttribute('r', '5')
// point.setAttribute('stroke', 'black')
// point.setAttribute('fill', 'black')
// point.setAttribute('stroke-width', '2')


// window.onload = async e => {

//     let fileLoader = document.getElementById('fileLoader')
//     fileLoader.onclick = async e => {
//         let buffer = await readFile()
//         let audio = new Float32Array(buffer)
//         let waveformPoints = audio.subarray(0, 48000)
//         console.log(waveformPoints.length)


//         //Start Audio
//         // let audioContext = new AudioContext({latencyHint: 0, sampleRate: 48000});
//         // await audioContext.audioWorklet.addModule('awp.js')
//         // let awp = new AudioWorkletNode(audioContext, 'awp', {numberOfInputs: [1], numberOfOutputs: [1], outputChannelCount: [2]});
//         // awp.connect(audioContext.destination)
//     }
// }






/**
 * 
 * @param {*} uiState --> per track clip postion, offset, backing file 
 * 
 * {trackId: [  {in: x, out: x, inTrim: x, outTrim: x, fileId: x},
 *              {in: x, out: x, inTrim: x, outTrim: x, fileId: x},
 * }
 * 
 */

 //construct Files Object
/**
 * OLD
 * { fileIdA:
 *          [   
 *              ArrayBuffer -->, becomes detached when passing to awp
 *              {trackId1: [ SAB, {in: x, out: x, inTrim: x, outTrim: x}, {in: x, out: x, inTrim: x, outTrim: x}, ],
 *              {trackId2: [ SAB, {in: x, out: x, inTrim: x, outTrim: x}, {in: x, out: x, inTrim: x, outTrim: x}, ]
 *          ]
 *           
 */



/**
 * MemoryObject
 * {fileUUIDv5: [ArrayBuffer, anythingElse?], }
 * 
 * 
 * Updated on UI change, on init
 * ClipsObject -- these should be sorted into timeline order? 
 * [{in: sampleNumber, out: sampleNumber, trims: [in, out], fileId: uuidv5},        ]
 * 
 *              x x x x x
 * 
 *                  5% or 60%
 *              
 * 
 *             --> pixel width (number of them), is proportional to actual length in samples relative to number of samples in the viewport
 * 
 *             480000 samples --> 1/60th of a 1 minute span
 *  
 *             To set a baseline for the viewport span. Just pick a max length (1 hour for example). Set grid lines accordingly, then all zoom steps are proportional to that
 */
