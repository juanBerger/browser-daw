
<script>

import { onMount } from 'svelte';
import { get } from 'svelte/store';
import {framesPerPixel} from './stores';

import { uuidv4 } from './utils.js';
import Clip from './Clip.svelte'

import Line from './Line.svelte'
import { AudioCore } from './audio-utils.js'

export let parent; //track div
export let fileId; //what is the backing audio file id
export let trackId; //this gets added to the metas
export let start; //start position on the timeline in pixels
export let clipTrims; //left and right trims in samples

//exposed in markup
let clipId;
let lineData;
let _clip;
let _mask;
let _points = '';
let _vbLength = 0; //the polyline creates a new point at each pixel
let _vbHeight = 0;
let _vbShift = '0';
let _maxSvgWidth = 0;

//let clipId;
//let lineTrims = [0, 0];
let hasLoaded = false;

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
let lastfpp = null;


const unsub = framesPerPixel.subscribe(fpp => {
    const zoom = () => {
        updateClipWidth(clipTrims, lineData, fpp);
        _maxSvgWidth = Number(window.getComputedStyle(_clip).getPropertyValue('--width').split('px')[0]);
        lastfpp = fpp;
    }
    
    !lastfpp ? lastfpp = fpp : zoom()
});


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


// const clipWidth = (lineData, clipTrims, spp) => {
//     let sampleWidth = lineData.sampleLength - (clipTrims[0] + clipTrims[1]);
//     let pixelWidth = (sampleWidth / spp) / lineData.channels
//     return Math.round(pixelWidth)
// }

// const setClipSize = (lineData, spp) => {
//     let audioFrames = (lineData.points.length * lineData.density) / lineData.channels
//     return Math.round(audioFrames / spp)
// }


// const zoomClips = fpp => {
//     let sampleLength = (lineTrims[1] - lineTrims[0]) * lineData.density
//     return Math.round((sampleLength / spp) / lineData.channels)
// }


/**
 * 
 * @param pixels
 * @param fpp
 * @param lineData
 */
const pixelsToLinePoints = (pixels, fpp, lineData) => {
    let frames = pixels * fpp
    return Math.round(frames / (lineData.density / lineData.channels));
}

/**
 * 
 * @param pixelChange : Positive to the right, negative to the left.
 * @param start: &start position in pixels. Updates this global var in place
 */
 const updatePosition = (pixelChange, start) => {
    start += pixelChange
    _clip.style.setProperty('--position', start + 'px')
    return start
}



const updateWaveform = (lineTrims, lineData) => {
    _points = lineData.points.slice(lineTrims[0], (lineData.points.length - lineTrims[1])).join(' ');
}


const updateClipWidth = (clipTrims, lineData, fpp) => {
    let totalWidth = (lineData.sampleLength / lineData.channels) - (clipTrims[0] + clipTrims[1]);
    totalWidth /= fpp;
    _clip.style.setProperty('--width', String(Math.round(totalWidth)) + 'px');
}


const clipTrimsToLineTrims = (clipChange, lineData) => {
    return clipChange.map(c => (
        (c / (lineData.density / lineData.channels))
    ))
}


/**
 * samples to pixels - 
 * @param samples - array to sum
 * @param fpp - current frames per pixel value
 */
const samplesToPixels = (samples, fpp) => {
    const totalFrames = samples.reduce((prev, current) => prev + current);
    return Math.round(totalFrames / fpp);
}

const pixelsToSamples = (pixels, fpp) => {
    return Math.round(pixels * fpp);
}

const setCoreTrims = (clipTrims, fileId, clipId, position, trackId) => {
    //clipTrims[0] -= 12000 //everything is a little off lol 
    clipTrims = clipTrims.map(ct => ct * 1);
    AudioCore.awp.port.postMessage({trims: {fileId: fileId, clipId: clipId, trackId: trackId, meta: [position * get(framesPerPixel), clipTrims[0], clipTrims[1]]}})
}

const updateTrims = (pixelChange, side, clipTrims, lineTrims, lineData) => {

    if (side === 'left'){
        clipTrims[0] += pixelsToSamples(pixelChange, get(framesPerPixel));
        start += pixelChange;
        
        lineTrims[0] += pixelsToLinePoints(pixelChange, get(framesPerPixel), lineData);
        _vbShift = String(Number(lineTrims[0]));  //Need to move the viewbox a commesurate amount
    }
    
    //for actual trimming pixel change will be negative
    else if (side === 'right'){
        pixelChange *= -1;
        clipTrims[1] += pixelsToSamples(pixelChange, get(framesPerPixel));
        lineTrims[1] += pixelsToLinePoints(pixelChange, get(framesPerPixel), lineData);
    }

    updateClipWidth(clipTrims, lineData, get(framesPerPixel));
    updateWaveform(lineTrims, lineData);
    start = updatePosition(0, start); //pixelChange is 0 here since this is the first call
    setCoreTrims(clipTrims, fileId, clipId, start, trackId); 

}

const clearCore = (fileId, clipId) => {
    AudioCore.awp.port.postMessage({clear: {fileId: fileId, clipId: clipId}});
}


onMount(async () => {
    
    if (fileId !== null){
        
        clipId = uuidv4();
        lineData = await AudioCore.getWaveform(fileId); //get waveform from back end

        _vbHeight = String(lineData.height);
        _vbLength = String(lineData.points.length);
        _maxSvgWidth = samplesToPixels([lineData.sampleLength / lineData.channels], get(framesPerPixel));
        
        let lineTrims = clipTrimsToLineTrims(clipTrims, lineData);
        updateTrims(0, 'left', clipTrims, lineTrims, lineData);
        updateTrims(0, 'right', clipTrims, lineTrims, lineData);
            
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

                const rOffset = Number(window.getComputedStyle(_clip).getPropertyValue('--width').split('px')[0]) - hlStart
                const lClipTrims = [clipTrims[0], clipTrims[1] + pixelsToSamples(rOffset, get(framesPerPixel))]
     
                new Clip({
                    target: parent,
                    props: {
                        start: start,
                        clipTrims: lClipTrims,
                        fileId: fileId,
                        parent: parent
                    }
                })
                
                const lOffset = hlStart + (hlEnd - hlStart);
                const rClipTrims = [clipTrims[0] + pixelsToSamples(lOffset, get(framesPerPixel)) , clipTrims[1]]
    
                new Clip({
                    target: parent,
                    props: {
                        start: start + lOffset,
                        clipTrims: rClipTrims,
                        fileId: fileId,
                        parent: parent
                    }
                })

                unsub(); //unsubs from the fpp store
                clearCore(fileId, clipId);
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
                start = updatePosition(e.movementX, start);
                setCoreTrims(clipTrims, fileId, clipId, start, trackId); 
            }

            else if (isTrimming){
                _clip.style.setProperty('--cursor', 'ew-resize');
                e.offsetX < _clip.offsetWidth * 0.05 && updateTrims(e.movementX, 'left', clipTrims, lineTrims, lineData);
                e.offsetX > _clip.offsetWidth * 0.95 && updateTrims(e.movementX, 'right', clipTrims, lineTrims, lineData);
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
        <svg xmlns="http://www.w3.org/2000/svg" width={_maxSvgWidth} height="100%" preserveAspectRatio='none' stroke-width='2' viewBox='{_vbShift} 0 {_vbLength} {_vbHeight}'>
           <polyline stroke='white' points={_points} fill='none'/>
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


    