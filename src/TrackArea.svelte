<script>

import { onMount } from 'svelte';
import { get } from 'svelte/store'
import { framesPerPixel } from './stores.js'
import { uuidv4 } from './utils.js';

import Track from './Track.svelte'
import Meter from './Meter.svelte'
import Playhead from './Playhead.svelte'

import { AudioCore } from './audio-utils.js'

export let leftArea;

//* Playhead related *//
let _this;
let _mouse = false;
let _zoomStep = 5; // 0 to 30 --> as this gets higher polyline height should somehow get smaller
let playheadHeight = 0;

let SR = 48000
let NUM_HOURS = 1


const readFile = async () => {
    
    const [handle] = await window.showOpenFilePicker({
        types: [{ description: '16 bit .wav file', accept: {'application/octet-stream': ['.wav']}}],
        startIn: 'desktop'}) 
    const file = await handle.getFile()
    const buffer = await file.arrayBuffer()
    return [buffer, file]
}


onMount(async () => {

    //** SET TO MAX WIDTH*/
    let totalSamples = SR * 60 * 60 * NUM_HOURS
    AudioCore.totalSamples = totalSamples
    framesPerPixel.ease(_zoomStep)
    let pixelWidth = String(Math.round(totalSamples / get(framesPerPixel)))
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
            framesPerPixel.ease(_zoomStep)
            console.log('[ZOOMING]')
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
                
                console.log(handle)
                let id = await AudioCore.addFile(audioBuffer, file.name.split('.wav')[0])
                console.log(id)
                if (id !== null) {
                    //if (hovering over existing track){
                        //add to that track
                    //}
                    //else:
                    let trackId = uuidv4();
                    const track = new Track({
                        target: _this,
                        props: {
                            fileId: id,
                            trackId: trackId,
                            parent: _this
                        }
                    })

                    let leftArea = document.getElementsByClassName('leftArea')[0];
                    const meter = new Meter({
                        target: leftArea,
                        props: {
                            fileId: id,
                            trackId: trackId,
                        }
                    })
                    
                }
                
            }
        }
    })

})


</script>

<div bind:this={_this} id='trackArea'>
    {#if _this}
        <Playhead height={playheadHeight}/>
    {/if}
</div>

<style>

#trackArea {

    --trackArea-width: 0;
    position: relative;
    grid-row-start: 3;
    grid-column-start: 3;
    display: flex;
    flex-direction: column;
    margin: 0.8em;
    width: var(--trackArea-width);
}

</style>









































