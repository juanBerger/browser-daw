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
let _zoomStep = 15; // 0 to 30 --> as this gets higher polyline height should somehow get smaller
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

    await AudioCore.create();

    let file = "test_1.wav";
    var req = new XMLHttpRequest();
    req.open("GET", file, true);
    req.responseType = "arraybuffer";
    req.send();
    req.onload = async e => {
        const audioBuffer = req.response;
        let fileId = await AudioCore.addFile(audioBuffer, file.split('.wav')[0]);
        let lineData = await AudioCore.getWaveform(fileId);
        
        console.log(lineData);
        // if (fileId !== null) {
        //     let trackId = uuidv4();
        //     const track = new Track({
        //         target: trackArea,
        //         props: {
        //             fileId: fileId,
        //             trackId: trackId,
        //             parent: trackArea,
        //         }
        //     })
        // }
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

    position: relative;
    grid-row-start: 3;
    grid-column-start: 3;
    display: flex;
    flex-direction: column;
    margin: 0.8em;
    width: 1fr;
}

</style>









































