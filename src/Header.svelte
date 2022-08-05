<script>

import {framesPerPixel, currentFrame} from './stores';

import { onMount } from "svelte";
import { get } from 'svelte/store';


let _this;
let TOTAL_PADDING = 9;

onMount(e => {

    _this.addEventListener('click', e => {
        let newPos = (e.offsetX - TOTAL_PADDING) * get(framesPerPixel)
        currentFrame.set(newPos)
    })
})


</script>

<div bind:this={_this} id='header'></div>


<style>

    #header {

        grid-column-start: 3;
        /* grid-column-end: 2; */
        grid-row-start: 1;
        grid-row-end: 2;

    }

</style>