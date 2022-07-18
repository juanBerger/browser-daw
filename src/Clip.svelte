
<script>

import { onMount } from 'svelte';
import { get } from 'svelte/store';
import {samplesPerPixel} from './stores';

import Line from './Line.svelte'
import { AudioCore } from './audio-utils.js'

export let start;
export let fileId;

let _clip;
let _svg;
let _waveform;
let _waveformTrims = [null, null]

let _numPoints = 0; //this is the number of pts in the polyline
let _points = '';
const _VBHEIGHT = '5000'; //this should be the same as the height const in the _generateWaveForm function
const _DENSITY = 50;

let vbTrim = 0;

let mouse = null;
let mouseDown = false;
let mouseUp = false;
let isTrimming = false;
let isMoving = false;
let isHighlighting = false;

//subscribe to the store using the subscribe method
// $: {    
//     const spp = $samplesPerPixel
//     if (_clip && spp > 0 && _waveform){
//         _clip.style.width = calculateClipSize(_waveform.sampleLength) + 'px';
//     }
// }

const calculateClipSize = (sampleLength) => {
    return String(Math.round((sampleLength / get(samplesPerPixel)) * 0.5))
}


const trimHandler = (e, side) => {
    
    //set as full width
    if (side === null && e === null){
        _waveformTrims = [0, _waveform.points.length - 1]
        _points = _waveform.points.slice(_waveformTrims[0], _waveformTrims[1]).join(' ')
        return
    }

    let trim;
    if (side === 'left'){
        trim = e.movementX * -1
        let translate = Number(window.getComputedStyle(_clip).getPropertyValue('--position').split('px')[0])
        translate += e.movementX
        _clip.style.setProperty('--position', translate + 'px')
        //_waveformTrims[0] += Math.round(e.movementX * ((get(samplesPerPixel) * 0.5) / _DENSITY))
        vbTrim += e.movementX * 10
        //_waveformTrims[0] += e.movementX
    
    }

    else {
        _waveformTrims[1] += Math.round(e.movementX * ((get(samplesPerPixel) / _DENSITY) * 0.5))
        trim = e.movementX
    }

     
    console.log(e.movementX, _waveformTrims)
    //_points = _waveform.points.slice(_waveformTrims[0], _waveformTrims[1]).join(' ')
    
    let divWidth = Number(_clip.style.width.split('px')[0]) + trim
    _clip.style.width = String(divWidth) + 'px'
   


    //do sample offsets here
    //let realSampleOffset = (trim * _DENSITY * get(samplesPerPixel));
    //AudioCore.awp.port.postMessage({trims: {fileId: []}}) //need to account for sample skips Density * samplesPerPixel when passing pointers bac
    
}

const setVerticalPointers = (e) => {
    let pointerType;
    if (mouse){
        if (e.offsetY > _clip.offsetHeight / 2){ 
            _clip.style.setProperty('--cursor', 'grab')
            pointerType = 'grab'
        }
        else {
            pointerType = 'text'
            _clip.style.setProperty('--cursor', 'text')
        }
    }
    return pointerType
}


const moveHandler = e => {
    e.movementX * 10
    let translate = Number(window.getComputedStyle(_clip).getPropertyValue('--position').split('px')[0])
    translate += e.movementX
    _clip.style.setProperty('--position', translate + 'px')
}


onMount(async () => {
    
    //[points, numPoints, numSamples]
    if (fileId !== null){
        
        //get waveform obj for this fileId
        _waveform = await AudioCore.getWaveform(fileId)
        
        //size clip to it based on num samples / 2 (bec they are interleaved) and current samplesPerPixel
        _clip.style.width = calculateClipSize(_waveform.sampleLength) + 'px'
        _clip.style.setProperty('--position', start + 'px')
        
        //set length of svg viewBox
        _numPoints = _waveform.points.length
        trimHandler(null, null)
    }

    //* MOUSE *//
    
    window.addEventListener('mouseup', e => {
        mouseDown = false
        if (isTrimming) isTrimming = false
        if (isMoving) isMoving = false
    })
    _clip.addEventListener('mouseenter', e => { mouse = true })
    _clip.addEventListener('mouseleave', e => { 
        mouse = false;
    })
    _clip.addEventListener('mousedown', e => mouseDown = true)

    _clip.addEventListener('mouseup', e => {
        if (mouse) setVerticalPointers(e)
    })
    
    _clip.addEventListener('mousemove', e => {

        if (isMoving){
            moveHandler(e)
            
        }

        else if (isTrimming){
            _clip.style.setProperty('--cursor', 'ew-resize')
            e.offsetX < _clip.offsetWidth * 0.2 && trimHandler(e, 'left');
            e.offsetX > _clip.offsetWidth * 0.8 && trimHandler(e, 'right');
        }
       
        else if (e.offsetX < _clip.offsetWidth * 0.2 || e.offsetX > _clip.offsetWidth * 0.8){
            _clip.style.setProperty('--cursor', 'ew-resize')
            if (mouseDown){
                isTrimming = true;
                e.offsetX < _clip.offsetWidth * 0.2 && trimHandler(e, 'left');
                e.offsetX > _clip.offsetWidth * 0.8 && trimHandler(e, 'right');
            }
        }

        else {
           let type = setVerticalPointers(e);
           console.log(type)
           if (mouseDown){
                if (type === 'grab'){
                    isMoving = true;
                }
                else {
                    isHighlighting = true;
                }
            }
            
        }
    })
//preserveAspectRatio='none'
})

</script>
<div bind:this={_clip} class='clip'>
    <div class="line">
        <svg bind:this={_svg} xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" stroke-width='2' preserveAspectRatio='none' viewBox='{vbTrim} 0 {_numPoints} {_VBHEIGHT}'>
           <polyline stroke='white' points={_points} fill='none'/>
        </svg>
    </div>
    <div class='mask'></div>
</div> 

<style>
    .clip {
        --position: 0px;
        --cursor: auto;
        box-shadow: 0.06em 0.06em 0.2em 0.09em rgba(163, 142, 168, 0.46);
        height: 89%;
        margin-top: auto;
        margin-bottom: auto;
        transform: translateX(var(--position));
        /* background: rgba(40, 205, 194, 0.06); */
        background: rgba(177, 177, 177, 0.06);
        cursor: var(--cursor);
    }

    .line {
        width: 100%;
        height: 100%;
    }

    .mask {
        position: absolute;
        width: 0px;
        height: 100%;
        background: black;
    }


</style>