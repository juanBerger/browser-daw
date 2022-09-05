<script>

import { onMount } from "svelte";
import { AudioCore } from './audio-utils.js';
import { Drawing } from './Drawing.js';
import { uuidv4 } from './utils.js';

import Track from './Track.svelte'

let trackArea;
let _clipArea;

let _zoomStep = 15; // 0 to 30 --> as this gets higher polyline height should somehow get smaller

let SR = 48000;
let MAX_HOURS = 1;


onMount(()=> {  

    let totalSamples = SR * 60 * 60 * MAX_HOURS;
    AudioCore.totalSamples = totalSamples;

    Drawing.init(document.getElementById('sceneCanvas'), document.getElementById('app'))

    /** FOR TEST **/
    let trackId = uuidv4();
    const track = new Track({
        target: trackArea,
        props: {
            fileId: '123',
            trackId: trackId,
            parent: trackArea,
        }
    })

    // let trackId_1 = uuidv4();
    // const track_1 = new Track({
    //     target: trackArea,
    //     props: {
    //         fileId: '124',
    //         trackId: trackId_1,
    //         parent: trackArea,
    //     }
    // })
})


</script>
    <div bind:this={trackArea} id='trackArea'>
        <!-- <canvas bind:this={sceneCanvas} id="sceneCanvas"/> -->
    </div>

<style>

/* #test {  
    width: 100%;
    height: 100%;
    visibility: hidden;
}



#clipArea {
    grid-row-start: 3;
    grid-column-start: 3;
    margin: 0.8em;
    background-color: rgba(36, 36, 36, 0.59);
    border-radius: 10px;

} */

#trackArea {

    grid-row-start: 3;
    grid-column: 1 / 4;

    display: flex;
    flex-direction: column;
    margin: 0.8em;

}

</style>

