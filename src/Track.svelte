<script>

import { onMount } from 'svelte';
import Clip from './Clip.svelte'

//export let audioBuffer;
//export let clips = []
export let fileId;
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
                start: 300,
                width: null,
                fileId: fileId,
                parent: _this
            }
        })

        _clips.push(clip)
    }
})

</script>

<div bind:this={_this} class='track'></div>



