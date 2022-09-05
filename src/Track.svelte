<script>

import { onMount } from 'svelte';
import Clip from './Clip.svelte'


export let parent;
export let fileId;
export let trackId;

let track;
let _mouse = false;
const _clips = [];

onMount(() => {
    

    track.addEventListener('mouseenter', (e) => _mouse = true)
    track.addEventListener('mouseleave', (e) => _mouse = false)
    

    const clip = new Clip({
        target: track,
        props: {
            translateX: 500,
            parentTrack: track
        }
    })

    _clips.push(clip)
    
})

</script>

<div bind:this={track} class='trackRow track'></div>

<style>


.trackRow.track {
    display: flex;
    border-bottom: 1px solid rgba(249, 206, 201, 0.373);
    width: 100%;
    /* grid-column: 1 / 4; */

}

</style>


