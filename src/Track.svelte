<script>

import { onMount } from 'svelte';
import Clip from './Clip.svelte'

export let parent;
export let fileId;
export let trackId;

let _this;
let _mouse = false;
const _clips = [];

onMount(() => {
    
    if(_this){

        _this.addEventListener('mouseenter', (e) => _mouse = true)
        _this.addEventListener('mouseleave', (e) => _mouse = false)
        
        const clip = new Clip({
            target: _this,
            props: {
                start: 10,
                clipTrims: [0, 0], //this means full width; //144000
                fileId: fileId,
                trackId: trackId,
                parent: _this,
            }
        })

        _clips.push(clip)
    }
})

</script>

<div bind:this={_this} class='trackRow track'></div>



<style>


.trackRow.track {
    /* height: 10%; */
    /* display: flex; */
    border-bottom: 1px solid rgba(249, 206, 201, 0.373);

}

</style>


