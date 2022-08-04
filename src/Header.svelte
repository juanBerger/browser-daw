<script>

import {framesPerPixel} from './stores';

import { onMount } from "svelte";
import { get } from 'svelte/store';

import { AudioCore } from './audio-utils.js'


let _this;

onMount(e => {

    _this.addEventListener('click', e => {
        let newPos = e.offsetX * get(framesPerPixel)
        if (AudioCore.awp){
            AudioCore.awp.port.postMessage({snap: newPos})     
        }  
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