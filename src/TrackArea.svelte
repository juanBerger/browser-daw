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

// window.onclick = async e => {
    
//     await AudioCore.create();
// }

onMount(async () => {

    //S E T    M A X    W I D T H //
    let totalSamples = SR * 60 * 60 * NUM_HOURS
    AudioCore.totalSamples = totalSamples
    framesPerPixel.ease(_zoomStep)
    let pixelWidth = String(Math.round(totalSamples / get(framesPerPixel)))
    _this.style.setProperty('--trackArea-width', pixelWidth + 'px')

    framesPerPixel.ease(_zoomStep)
    await AudioCore.create();

    let file = "test_1.wav";
    const req = new XMLHttpRequest();
    req.open("GET", file, true);
    req.responseType = "arraybuffer";
    req.send();
    req.onload = async e => {
        const audioBuffer = req.response;
        const fileId = await AudioCore.addFile(audioBuffer, file.split('.wav')[0]);
        if (fileId !== null) {
            const track = new Track({
                target: trackArea,
                props: {
                    fileId: fileId,
                    trackId: uuidv4(),
                    parent: trackArea,
                }
            })
        }
    }
})




</script>

    <div bind:this={_this} id='trackArea'>
        <!-- {#if _this}
            <Playhead height={playheadHeight}/>
        {/if} -->
    </div>

<style>

#trackArea {
    --trackArea-width: 0px;
    position: relative;
    grid-row-start: 3;
    grid-column-start: 3;
    display: flex;
    flex-direction: column;
    margin: 0.8em;
    width: var(--trackArea-width);
}

</style>









































