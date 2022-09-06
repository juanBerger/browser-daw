<script>

import { onMount } from 'svelte';
import Clip from './Clip.svelte'

export let fileId;
export let trackId;
export let parent;

let track;
let mouse = false;
const _clips = [];

const getLeftOffset = (() => {

    const clipMargin = Number(window.getComputedStyle(document.getElementById('clipArea')).marginLeft.split('px')[0])
    return document.getElementById('leftArea').clientWidth + clipMargin + 2.5; // this last number is for styling  
})


onMount(() => {

    track.addEventListener('mouseenter', (e) => mouse = true)
    track.addEventListener('mouseleave', (e) => mouse = false)
    
    
    const clip = new Clip({
        target: track,
        props: {
            fileId: fileId,
            trackId: trackId,
            parent: parent,
            translateX: 0 + getLeftOffset(),
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


