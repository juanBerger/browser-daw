<script>

import { onMount } from 'svelte';
import { get } from 'svelte/store'
import { samplesPerPixel } from './stores.js'

import Track from './Track.svelte'
import Strip from './Strip.svelte'
import Playhead from './Playhead.svelte'

import { AudioCore } from './audio-utils.js'

//* Playhead related *//
let _this;
let _mouse = false;
let _zoomStep = 5; // 0 to 30 --> as this gets higher polyline height should somehow get smaller
let playheadHeight = 0;

let SR = 48000
let NUM_HOURS = 1

const TEST_STRING = "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"

async function initTesting(audioString){

    let binaryString = btoa(audioString)
    let 


    let id = await AudioCore.addFile(audioBuffer, 'testWav')
                
    if (id !== null) {
        //if (hovering over existing track){
            //add to that track
        //}
        //else:
        const track = new Track({
            target: _this,
            props: {
                fileId: id //could be multiple?
            }
        })
    }

}


//update this to work on fire fox
async function buttonClicked(e){
    
    const fileObj = await readFile()
    if (fileObj[0].byteLength > 0){

        if (!AudioCore.awp) await AudioCore.create()

        else if (AudioCore.audioContext.state === 'suspended'){
            await AudioCore.audioContext.resume()
            console.log(AudioCore.audioContext.state)
        }

        //this is like a function call which we will await -- success = unique id. AWP determined if dup or not
        let id = await AudioCore.addFile(fileObj[0], fileObj[1].name.split('.wav')[0])
        
        if (id !== null) {
            //if (hovering over existing track){
                //add to that track
            //}
            //else:
            const track = new Track({
                target: _this,
                props: {
                    fileId: id //could be multiple?
                }
            })
        }

    }

}


const readFile = async () => {
    
    const [handle] = await window.showOpenFilePicker({
        types: [{ description: '16 bit .wav file', accept: {'application/octet-stream': ['.wav']}}],
        startIn: 'desktop'}) 
    const file = await handle.getFile()
    const buffer = await file.arrayBuffer()
    return [buffer, file]
}


onMount(async () => {


    initTesting(TEST_STRING);


    
    //** SET TO MAX WIDTH*/
    let totalSamples = SR * 60 * 60 * NUM_HOURS
    AudioCore.totalSamples = totalSamples
    samplesPerPixel.ease(_zoomStep)
    let pixelWidth = String(Math.round(totalSamples / get(samplesPerPixel)))
    _this.style.setProperty('--trackArea-width', pixelWidth + 'px')
    


    /** LISTEN TO THIS RESIZE */
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries){ playheadHeight = entry.contentRect.height }
    })
    resizeObserver.observe(_this)
    

    /** ZOOMING */
    _this.addEventListener('mouseenter', e => _mouse = true)
    _this.addEventListener('mouseleave', e => _mouse = false)
    document.addEventListener('keydown', e => {
        if (e.key === 'r' || e.key === 't'){
            if (e.key === 'r') _zoomStep >= 30 ? _zoomStep = _zoomStep : _zoomStep++
            else _zoomStep <= 0 ? _zoomStep = _zoomStep : _zoomStep--
            samplesPerPixel.ease(_zoomStep)
        }          
    })


    //* DRAG AND DROP *//   
    _this.addEventListener('dragover', e => { e.preventDefault() })
    _this.addEventListener('drop', async e => {

        e.preventDefault()

        let handles = Array.from(e.dataTransfer.items)
        .filter(handle => handle.type.includes('audio'))
        .map(handle => handle.getAsFileSystemHandle())

        for await (const handle of handles){
            const file = await handle.getFile()
            const audioBuffer = await file.arrayBuffer()
            if (audioBuffer.byteLength > 0){

                if (!AudioCore.awp) await AudioCore.create()
                
                else if (AudioCore.audioContext.state === 'suspended'){
                    await AudioCore.audioContext.resume()
                    console.log(AudioCore.audioContext.state)
                }
                
                


                //this is like a function call which we will await -- success = unique id. AWP determined if dup or not
                let id = await AudioCore.addFile(audioBuffer, file.name.split('.wav')[0])
                
                if (id !== null) {
                    //if (hovering over existing track){
                        //add to that track
                    //}
                    //else:
                    const track = new Track({
                        target: _this,
                        props: {
                            fileId: id //could be multiple?
                        }
                    })
                }
                
            }
        }
    })

})


</script>

<div bind:this={_this} id='trackArea'>
    
    <button id='button' on:click={buttonClicked}>Load a file</button>    
    
    {#if _this}
        <Playhead height={playheadHeight}/>
    {/if}
</div>

<style>

#button {

    width: 300px;

}

#trackArea {

    --trackArea-width: 0;
    position: relative;
    grid-row-start: 3;
    grid-column-start: 3;
    display: flex;
    flex-direction: column;
    margin: 0.8em;
    width: var(--trackArea-width);
    /* overflow: hidden; */
}

</style>






<!-- 

//* for use with picker *//
const readFile = async () => {
    const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Pro Tools Session Files', accept: {'application/octet-stream': ['.wav']}}],
        startIn: 'desktop'}) 
    const file = await handle.getFile()
    const buffer = await file.arrayBuffer()
    return buffer
}
 -->

























































