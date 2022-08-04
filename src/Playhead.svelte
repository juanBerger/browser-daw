<script>

import { onMount, onDestroy } from 'svelte';
import { get } from 'svelte/store'
import { framesPerPixel, currentFrame } from './stores.js'

import { AudioCore } from './audio-utils.js'

export let height;

let _this;
let isPlaying = false;
let modifierKey = false; //TEMP

const updateStyle = (pixelPosition) => _this.style.setProperty('--playhead-pos', pixelPosition + 'px');

const unsub = currentFrame.subscribe(frame => {
    let pixelPosition = frame / get(framesPerPixel);
    console.log(pixelPosition)
    if (_this){
        updateStyle(pixelPosition);
    }
});


onDestroy(() => {unsub();})

onMount(async () => {

    //* PLAYHEAD *//
    window.addEventListener('keydown', async e => {

        //In this case - no clips have been added
        if (!AudioCore.awp) await AudioCore.create()
        
        if (AudioCore.audioContext.state === 'suspended') await AudioCore.audioContext.resume()
    
        if (e.key != ' ') return
                
        let playState = 'stop'
        if (!isPlaying){
            isPlaying = true;
            playState === 'play';
        }

        let startPos = get(currentFrame);
        if (modifierKey){
            startPos = 0
            currentFrame.set(0)
            updateStyle()
        }

        //AudioCore.awp.port.postMessage({playState: playState, startPos: startPos});
           
    })

})


$: {

    if (_this){
        _this.style.setProperty('--playhead-height', height + 'px')
    }

}


</script>

<div bind:this={_this} id='playhead'/>

<style>

#playhead {

    --playhead-height: 0px;
    --playhead-pos: 0px;
    position: absolute;
    left: var(--playhead-pos);
    border: 1px solid rgba(212, 73, 243, 0.635);
    border-radius: 10px;
    width: 1px;
    height: var(--playhead-height);
    background-color:rgba(255, 255, 0, 0.286)

}


</style>


