<script>

import { onMount } from 'svelte';
import LinearGradient from './LinearGradient.svelte'

export let waveform;
export let trims;

let _this;
let _svg;
let _numPoints = 0; //this is the number of pts in the polyline
let _points = '';
let _vbHeight = '5000'; //this should be the same as the height const in the _generateWaveForm function


$: {
    console.log('Trims')
}




//maybe only listen to trims
onMount(() => {
    _numPoints = Math.round(waveform.sampleLength / waveform.density)
    _points = waveform.points
})

//preserveAspectRatio='none'
</script>

<div bind:this={_this} class="line">
    <svg bind:this={_svg} xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" stroke-width='2' preserveAspectRatio='none' viewBox='0 0 {_numPoints} {_vbHeight}'>
       <polyline stroke='white' points={_points} fill='none'/>
    </svg>
</div>

