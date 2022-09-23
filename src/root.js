import './styles.css'
import App from './App.svelte'
import { AudioCore, CanvasCore } from './audio-utils.js';

window.onload = async () => { 
    await AudioCore.create();
    
    const app = new App({target: document.getElementById('root')})
    const canvasWorker = CanvasCore.create();

    const pOffscreen = document.getElementById('playCanvas').transferControlToOffscreen();
    canvasWorker.port.postMessage({playCanvas: pOffscreen}, [pOffscreen]);

    //other canvases

    AudioCore.awp.port.postMessage({canvasPort: canvasWorker.port}, [canvasWorker.port])


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

 // //** SET TO MAX WIDTH*/
    // let totalSamples = SR * 60 * 60 * NUM_HOURS
    // AudioCore.totalSamples = totalSamples
    // framesPerPixel.ease(_zoomStep)
    // let pixelWidth = String(Math.round(totalSamples / get(framesPerPixel)))
    // _this.style.setProperty('--trackArea-width', pixelWidth + 'px')
    

    // /** LISTEN TO THIS RESIZE */
    // const resizeObserver = new ResizeObserver(entries => {
    //     for (let entry of entries){ playheadHeight = entry.contentRect.height }
    // })
    // resizeObserver.observe(_this)
    

    // /** ZOOMING */
    // _this.addEventListener('mouseenter', e => _mouse = true)
    // _this.addEventListener('mouseleave', e => _mouse = false)
    // document.addEventListener('keydown', e => {
    //     if (e.key === 'r' || e.key === 't'){
    //         if (e.key === 'r') _zoomStep >= 30 ? _zoomStep = _zoomStep : _zoomStep++
    //         else _zoomStep <= 0 ? _zoomStep = _zoomStep : _zoomStep--
    //         framesPerPixel.ease(_zoomStep)
    //         //console.log('[ZOOMING]')
    //     }          
    // })




    // //* DRAG AND DROP *//   
    //_this.addEventListener('dragover', e => { e.preventDefault() })
    //_this.addEventListener('drop', async e => {

    //    e.preventDefault()

        // let handles = Array.from(e.dataTransfer.items)
        // .filter(handle => handle.type.includes('audio'))
        // .map(handle => handle.getAsFileSystemHandle())

        // for await (const handle of handles){
        //     const file = await handle.getFile()
        //     const audioBuffer = await file.arrayBuffer()
        //     if (audioBuffer.byteLength > 0){

        //         if (!AudioCore.awp) await AudioCore.create()
                
        //         else if (AudioCore.audioContext.state === 'suspended'){
        //             await AudioCore.audioContext.resume()
        //             console.log(AudioCore.audioContext.state)
        //         }
                
        //         console.log(handle)
        //         // let id = await AudioCore.addFile(audioBuffer, file.name.split('.wav')[0])
        //         // const lineData = await AudioCore.getWaveform(id); //get waveform from back end
        //         // console.log(lineData)


        //         if (id !== null) {
                    
                    



                    
                    
                    
                    
        //             //if (hovering over existing track){
        //                 //add to that track
        //             //}
        //             //else:
        //             // let trackId = uuidv4();
        //             // const track = new Track({
        //             //     target: _this,
        //             //     props: {
        //             //         fileId: id,
        //             //         trackId: trackId,
        //             //         parent: _this
        //             //     }
        //             // })

        //             // let leftArea = document.getElementsByClassName('leftArea')[0];
        //             // const meter = new Meter({
        //             //     target: leftArea,
        //             //     props: {
        //             //         fileId: id,
        //             //         trackId: trackId,
        //             //     }
        //             // })
                    
        //         }
                
        //     }
        //}