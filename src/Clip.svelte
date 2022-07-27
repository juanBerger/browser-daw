
<script>

import { onMount } from 'svelte';
import { get } from 'svelte/store';
import {samplesPerPixel} from './stores';

import { uuidv4 } from './utils.js';
import Clip from './Clip.svelte'

import Line from './Line.svelte'
import { AudioCore } from './audio-utils.js'

export let start;
export let fileId;
export let width;
export let parent;


let lineData = null;
let vbLength = 0; //the polyline creates a new point at each pixel
let vbHeight = 0;
let vbShift = '0';
let maxSvgWidth;

let _clip;
let _mask;
let clipId;
let lineTrims = [0, 0];
let clipTrims = [0, 0];
let hasLoaded = false;

let points = '';

/* Mouse states */
let mouse = null;
let mouseDown = false;
let mouseUp = false;

/* Actions */
let isTrimming = false;
let isMoving = false;
let isHighlighting = false;
let firstHighlight = true;

let hlStart = 0;
let hlEnd = 0;


// $: {
//     const spp = $samplesPerPixel
//     if (hasLoaded){
//         let newWidth = zoomClips(spp);
//         maxSvgWidth = newWidth;
//         _clip.style.setProperty('--width', String(newWidth) + 'px')
//     }
// }


const trimHandler = (e, side) => {

    //
    let lineTrim = Math.round((e.movementX * get(samplesPerPixel)) / (lineData.density * 0.5));
    let clipTrim = e.movementX
    
    if (side === 'left'){
        lineTrims[0] += lineTrim
        clipTrims[0] += clipTrim * get(samplesPerPixel)
        start += clipTrim
        
        //Trimming from left requires clip to move
        let translate = Number(window.getComputedStyle(_clip).getPropertyValue('--position').split('px')[0])
        translate += clipTrim
        vbShift = String(Number(vbShift) + lineTrim)  //Need to move the viewbox a commesurate amount
        _clip.style.setProperty('--position', translate + 'px')
        
        clipTrim *= -1;
        console.log(clipTrims[0])
    }

    else {
        if (lineTrims[1] === 0) console.error('No waveform loaded')
        lineTrims[1] += lineTrim;
        clipTrims[1] += clipTrim * get(samplesPerPixel) * -1;
        
    }

    //Inform the back end
    setCoreTrims(clipTrims, start);
    
    //update line drawing
    points = lineData.points.slice(lineTrims[0], lineTrims[1]).join(' ');

    //update clip size
    let clipWidth = Number(_clip.style.getPropertyValue('--width').split('px')[0]) + clipTrim
    _clip.style.setProperty('--width', String(clipWidth) + 'px');
    
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
    //let translate = Number(window.getComputedStyle(_clip).getPropertyValue('--position').split('px')[0])
    start += e.movementX
    //translate += e.movementX
    _clip.style.setProperty('--position', start + 'px')

    setCoreTrims(clipTrims, start)
}

const highlightHandler = e => {
    
    if (firstHighlight){
        _mask.style.setProperty('--opacity', 0.3)
        firstHighlight = false;
        hlStart = e.offsetX
        hlEnd = hlStart
        _mask.style.setProperty('--position', String(hlStart) + 'px')
        return
    }
    
    hlEnd += e.movementX
    let delta = Math.abs(hlEnd - hlStart)
    if (hlEnd < hlStart){
        _mask.style.setProperty('--position', String(hlStart - delta) + 'px')

    }
    _mask.style.setProperty('--width', String(delta) + 'px')
}


const setClipSize = (lineData, spp) => {
    let audioFrames = (lineData.points.length * lineData.density) / lineData.channels
    return Math.round(audioFrames / spp)
}

const zoomClips = spp => {
    let sampleLength = (lineTrims[1] - lineTrims[0]) * lineData.density
    return Math.round((sampleLength / spp) / lineData.channels)
}

//can we supply this in terms of pixel-sample space // li
const setCoreTrims = (clipTrims, position) => {
    AudioCore.awp.port.postMessage({trims: {fileId: fileId, clipId: clipId, meta: [position * get(samplesPerPixel), clipTrims[0], clipTrims[1]]}})
}
onMount(async () => {
    
    if (fileId !== null){
        
        _clip.style.setProperty('--position', start + 'px')
        lineData = await AudioCore.getWaveform(fileId) //get data from audio back end

        clipId = uuidv4()

        lineTrims = [0, lineData.points.length - 1] //set trim amounts
        clipTrims = [0, 0] //these are now only offsets
        setCoreTrims(clipTrims, start);
    
        //Clip Dims
        if (width === null) width = String(setClipSize(lineData, get(samplesPerPixel)));
        else width = String(width);
        _clip.style.setProperty('--width', width + 'px');
        
        //SVG Dims
        vbHeight = String(lineData.height)
        vbLength = String(lineData.points.length)
        maxSvgWidth = Number(_clip.style.getPropertyValue('--width').split('px')[0]) 

        points = lineData.points.slice(0, lineData.points.length).join(' ')
        
        //* MOUSE *//
        window.addEventListener('mousedown', e => {
            
            //reset any highlights
            _mask.style.setProperty('--opacity', 0);
            _mask.style.setProperty('--position', String(hlStart) + 'px');
            _mask.style.setProperty('--width', '0px');
            hlStart = 0;
            hlEnd = 0;

        })


        window.addEventListener('keydown', e => {
            
            if(e.key === 'Backspace' && (Math.abs(hlStart - hlEnd) > 0)){

                let s = Number(window.getComputedStyle(_clip).getPropertyValue('--position').split('px')[0]);
                let w = hlStart - s;
                //if (hlEnd < hlStart) w = s + hlEnd; //hlEnd is negative here -- > this right?

                console.log(s, w)
                new Clip({
                    target: parent,
                    props: {
                        start: s,
                        width: w,
                        fileId: fileId,
                        parent: parent
                    }
                })

                
                let sRight = s + hlEnd;
                let wRight = Number(width.split('px')[0]) - hlEnd;

                new Clip({
                    target: parent,
                    props: {
                        start: sRight,
                        width: wRight,   
                        fileId: fileId,
                        parent: parent
                    }
                })

                parent.removeChild(_clip)
            }
        })


        //reset flags here since we may be outside of the clip
        window.addEventListener('mouseup', e => {
            
            mouseDown = false;
            isTrimming = false;
            isMoving = false;
            isHighlighting = false; //the highlight may still be visible, but it is no longer changing
            firstHighlight = true;
            // hlStart = 0;
            // hlEnd = 0;
        })

        _clip.addEventListener('mouseenter', e => { mouse = true; })
        _clip.addEventListener('mouseleave', e => { mouse = false; })
        _clip.addEventListener('mousedown', e => mouseDown = true)

        _clip.addEventListener('mouseup', e => {
            //isTrimming isMoving etc are reset on the window version of this event listener
            if (mouse) setVerticalPointers(e)
        })
        
        _clip.addEventListener('mousemove', e => {

            if (isHighlighting){
                highlightHandler(e);
            
            }
            
            else if (isMoving){
                moveHandler(e);
            }

            else if (isTrimming){
                _clip.style.setProperty('--cursor', 'ew-resize');
                e.offsetX < _clip.offsetWidth * 0.05 && trimHandler(e, 'left');
                e.offsetX > _clip.offsetWidth * 0.95 && trimHandler(e, 'right');
            }
        
            else if (e.offsetX < _clip.offsetWidth * 0.05 || e.offsetX > _clip.offsetWidth * 0.95){
                if (e.srcElement.id != '-mask'){ //make sure we are referencing the clip
                    _clip.style.setProperty('--cursor', 'ew-resize');
                    if (mouseDown) isTrimming = true;
                }
            }

            else {
            let type = setVerticalPointers(e);
            if (mouseDown){
                    if (type === 'grab') isMoving = true;
                    else if (type === 'text') isHighlighting = true;
                }
            }
        })
    
        hasLoaded = true;

    }
    
    else console.error('No Audio Associated With This Clip')
})

</script>
<div bind:this={_clip} class='clip'>
    <div bind:this={_mask} class='mask' id='-mask'></div>
    <div class="line">
        <svg xmlns="http://www.w3.org/2000/svg" width={maxSvgWidth} height="100%" preserveAspectRatio='none' stroke-width='2' viewBox='{vbShift} 0 {vbLength} {vbHeight}'>
           <polyline stroke='white' points={points} fill='none'/>
        </svg>
    </div>
</div> 

<style>
    .clip {
        --position: 0px;
        --cursor: auto;
        --width: 0px;
        display: grid;
        grid-template-rows: 100%;
        box-shadow: 0.06em 0.06em 0.2em 0.09em rgba(163, 142, 168, 0.46);
        height: 89%;
        width: var(--width);
        margin-top: auto;
        margin-bottom: auto;
        transform: translateX(var(--position));
        background: rgba(177, 177, 177, 0.06);
        cursor: var(--cursor);
    }

    .line {
        width: 100%;
        height: 100%;
        grid-row-start: 1;
        grid-column-start: 1;
    }

    .mask {
        --opacity: 0;
        --position: 0px;
        --width: 0px;
        width: var(--width);
        transform: translateX(var(--position));
        height: 100%;
        grid-row-start: 1;
        grid-column-start: 1;
        background: rgba(209, 213, 255, var(--opacity)); /*up to 0.2 maybe*/
    
    }


</style>