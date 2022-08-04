<script>

import { onMount } from 'svelte';
import { get } from 'svelte/store'
import { framesPerPixel } from './stores.js'

import { AudioCore } from './audio-utils.js'

export let height;

let _this;
let _isPlaying = false;
let _lastSampleValue = 0;
let _pixelPosition = 0;


onMount(async () => {

    //the counter has to map the playhead to a specific pixel. This is based on samplesPerPixrel // 
    const updateStyle = () => _this.style.setProperty('--playhead-pos', _pixelPosition + 'px');
    
    //need a guard here - revisit selectors thing
    const handlePlayHeadMessage = e => {
        
        
        if (e.data.tick){
            if (e.data.tick.samples - _lastSampleValue >= (get(framesPerPixel)) && _isPlaying){
                _pixelPosition = Math.round(e.data.tick.samples / get(framesPerPixel)) // + any scrolled amount
                updateStyle()
                _lastSampleValue = e.data.tick.samples
            }
        }


        else if (e.data.snap){
            _pixelPosition = Math.round(e.data.snap / get(framesPerPixel)) // + any scrolled amount
            updateStyle()
            _lastSampleValue = e.data.snap
        }
      
    }

    AudioCore.registerCallback(handlePlayHeadMessage);

    //* PLAYHEAD *//
    document.addEventListener('keydown', async e => {
        

        //In this case - no clips have been added
        if (!AudioCore.awp) await AudioCore.create()
        
        if (AudioCore.audioContext.state === 'suspended') await AudioCore.audioContext.resume()
    
        if (e.key != ' ') return

        //** TEMP */
        let startPos = [0, 0, 0, 0]

        if(!_isPlaying){
            _isPlaying = true
            AudioCore.awp.port.postMessage({playState: 'play', startPos: null});
        }

        else {
            _isPlaying = false
            AudioCore.awp.port.postMessage({playState: 'stop', startPos: null});
            //_lastSampleValue = 0;
            //_pixelPosition = 0;
            //updateStyle();
        }

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

div {

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


