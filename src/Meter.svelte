<script>
import { onMount } from 'svelte';
import { AudioCore } from './audio-utils.js'

export let fileId;
export let trackId;

let _this;
let _mask;
let meterMask = null;
let prevMaskHeight = '100%';
let newMaskHeight = null;

const keyframes = [
    {height: prevMaskHeight},
    {height: newMaskHeight}
]

const timing = {
    duration: 3000,
    iterations: 1
}


const handleMeterMessage = e => {
    if (e.data.amplitude && e.data.amplitude.track === trackId){
        
        newMaskHeight = String(100 - (e.data.amplitude.amplitude * 100)) + '%'
        //console.log(newMaskHeight)
        _mask.animate([
            {height: prevMaskHeight},
            {height: newMaskHeight}
        ], 3)
        
        prevMaskHeight = newMaskHeight;

    }
}


onMount(() => {

    newMaskHeight = '50%';
    _mask.animate([
        {height: prevMaskHeight},
        {height: newMaskHeight}
    ], 1)

    prevMaskHeight = newMaskHeight;
    
    
    AudioCore.registerCallback(handleMeterMessage)
})

</script>


<div class="trackRow meter">
    <div id='meterMat'>
        <div id='meterColors'>
            <div bind:this={_mask} id='meterMask'/>
        </div>
    </div>
</div>

<style>


#meterMat {
    width: 15%;
    background-color: rgba(28,28,28, 1);
    margin-left: auto;
    margin-bottom: 0.3em;
    margin-right: 0.2em;
}

#meterColors {
    width: 60%;
    height: 100%;
    margin: auto;
    background: linear-gradient(#e21d1d 4%, #ff9d00 12%, #fff200 22%, #f2ea00 37%, #52b152 59%, #52b152 59%, #008a00 79%);
 
}

#meterMask {
    --maskHeight: 100%;
    animation-duration: 1s;
    animation-name: newAmplitude;
    background: rgba(28,28,28, 1);
    height: var(--maskHeight)
}


.trackRow.meter {
    /* height: 10%; */
    display: flex;
    border-bottom: 1px solid rgba(249, 206, 201, 0.373);
}

    
</style>