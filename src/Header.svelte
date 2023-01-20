<script>

import {framesPerPixel } from './stores';
import { onMount } from "svelte";
import { get } from 'svelte/store';
import { AudioCore } from './audio-utils.js';

let header;
let TOTAL_PADDING = 9;

onMount(e => {

    header.addEventListener('click', e => {
        const framePos = (e.offsetX - TOTAL_PADDING) * get(framesPerPixel)
        AudioCore.awp.port.postMessage({snap: framePos})
    })
})


</script>

<div bind:this={header} id='header'></div>


<style>

    #header {

        grid-column-start: 3;
        grid-row-start: 1;
        grid-row-end: 2;

    }

</style>