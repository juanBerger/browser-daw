
<script>

    import { onMount, tick, afterUpdate, createEventDispatcher } from 'svelte';

    import { get } from 'svelte/store';
    import {framesPerPixel, userEvents} from './stores';

    import { uuidv4 } from './utils.js';
    // import Clip from './Clip.svelte'

    import { AudioCore } from './audio-utils.js'

    export let parent; //track div
    export let fileId; //what is the backing audio file id
    export let trackId; //this gets added to the metas
    export let start; //start position on the timeline in pixels
    export let clipTrims; //left and right trims in frames

    //exposed in markup
    let clipId;
    let lineData;
    let clip;
    let _mask;
    let _points = '';
    let vbLength = 0; //the polyline creates a new point at each pixel
    let vbHeight = 0;
    let vbShift = '0';
    let _maxSvgWidth = 0;


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
            
            let prevPosFrames = pixelsToFrames(start, lastfpp);
            let newPosPixels = framesToPixels([prevPosFrames], fpp)
            let delta = newPosPixels - start; //should be negative when we zoom out
            start = updatePosition(delta, start);
            _maxSvgWidth = Number(window.getComputedStyle(clip).getPropertyValue('--width').split('px')[0]);
            lastfpp = fpp;
        }
        
        //skip the zoom operation when the fpp is initially set on load
        !lastfpp ? lastfpp = fpp : zoom();
    });


    const setVerticalPointers = (e) => {
        
        let pointerType;
        
        if (mouse){
            if (e.offsetY > clip.offsetHeight / 2){ 
                clip.style.setProperty('--cursor', 'grab')
                pointerType = 'grab'
            }
            else {
                pointerType = 'text'
                clip.style.setProperty('--cursor', 'text')
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
     * @param start: start position in pixels. Updates this global var in place
     */
    const updatePosition = (pixelChange, start) => {
        start += pixelChange
        clip.style.setProperty('--position', start + 'px')
        return start
    }


    const updateWaveform = (lineTrims, lineData) => {
        const subArray = lineData.points.slice(lineTrims[0], (lineData.points.length - lineTrims[1]));
        vbLength = String(subArray.length)
        _points = subArray.join(' ');
    }


    const updateClipWidth = (clipTrims, lineData, fpp) => {
        let totalWidth = (lineData.sampleLength / lineData.channels) - (clipTrims[0] + clipTrims[1]);
        totalWidth /= fpp;
        clip.style.setProperty('--width', String(Math.round(totalWidth)) + 'px');
    }


    const clipTrimsToLineTrims = (clipChange, lineData) => {
        return clipChange.map(c => (
            (c / (lineData.density / lineData.channels))
        ))
    }


    /**
     * frames to pixels - 
     * @param frames - array to sum. This is so that we can easily use with trims
     * @param fpp - current frames per pixel value
     */
    const framesToPixels = (frames, fpp) => {
        const totalFrames = frames.reduce((prev, current) => prev + current);
        return Math.round(totalFrames / fpp);
    }

    const pixelsToFrames = (pixels, fpp) => {
        return Math.round(pixels * fpp);
    }

    const setCoreTrims = (clipTrims, fileId, clipId, position, trackId) => {
        //clipTrims[0] -= 12000 //everything is a little off lol 
        //clipTrims = clipTrims.map(ct => ct * 1);
        AudioCore.awp.port.postMessage({trims: {fileId: fileId, clipId: clipId, trackId: trackId, meta: [position * get(framesPerPixel), clipTrims[0], clipTrims[1]]}})
    }

    const updateTrims = (pixelChange, side, clipTrims, lineTrims, lineData) => {

        if (side === 'left'){
            let lNewClipTrim = clipTrims[0] + pixelsToFrames(pixelChange, get(framesPerPixel));
            if (lNewClipTrim < 0) return;
            clipTrims[0] = lNewClipTrim;
            start += pixelChange;
            
            let lNewLineTrim = lineTrims[0] + pixelsToLinePoints(pixelChange, get(framesPerPixel), lineData);
            if (lNewLineTrim < 0) return;
            lineTrims[0] = lNewLineTrim
            vbShift = String(Number(lineTrims[0]));  //Need to move the viewbox a commesurate amount
        }
        
        //for actual trimming pixel change will be negative
        else if (side === 'right'){
            pixelChange *= -1;``
            let rNewClipTrim = clipTrims[1] + pixelsToFrames(pixelChange, get(framesPerPixel));
            if (rNewClipTrim < 0) return;
            clipTrims[1] = rNewClipTrim
            
            let rNewLineTrim = lineTrims[1] + pixelsToLinePoints(pixelChange, get(framesPerPixel), lineData);
            if (rNewLineTrim < 0) return;
            lineTrims[1] = rNewLineTrim;
        }

        updateClipWidth(clipTrims, lineData, get(framesPerPixel));
        updateWaveform(lineTrims, lineData);
        setCoreTrims(clipTrims, fileId, clipId, start, trackId); 

    }

    const clearCore = (fileId, clipId) => {
        AudioCore.awp.port.postMessage({clear: {fileId: fileId, clipId: clipId}});
    }


    


    onMount(async () => {
        
        if (fileId !== null){
            
            clip.id = clipId; //tag the DOM element with our passed in ID
            lineData = await AudioCore.getWaveform(fileId); //get waveform from back end

            vbHeight = String(lineData.height); //an arbitrary nmber of pixels since height is scaled to conatiner box. Higher values create lighter looking lines
            vbLength = String(lineData.points.length); //this is really already in pixel space because each point increments by one pixel (its 1px per 'density' number of samples)

            let lineTrims = clipTrimsToLineTrims(clipTrims, lineData);
            updateTrims(0, 'left', clipTrims, lineTrims, lineData);
            updateTrims(0, 'right', clipTrims, lineTrims, lineData);
            start = updatePosition(0, start);
                
            //* MOUSE *//
            window.addEventListener('mousedown', e => {
                //reset any highlights
                _mask.style.setProperty('--opacity', 0);
                _mask.style.setProperty('--position', String(hlStart) + 'px');
                _mask.style.setProperty('--width', '0px');
                hlStart = 0;
                hlEnd = 0;

            })


            window.addEventListener('keydown', async e => {
                
                if(e.key === 'Backspace' && (Math.abs(hlStart - hlEnd) > 0)){

                    const clipLength = Number(window.getComputedStyle(clip).getPropertyValue('--width').split('px')[0])
                    const fpp = get(framesPerPixel);
                    
                    const leftTrims = [clipTrims[0], clipTrims[1] + pixelsToFrames(clipLength - hlStart, fpp)]
                    const leftStart = start;
                    

                    const rightTrims = [clipTrims[0] + pixelsToFrames(hlEnd, fpp), clipTrims[1]]
                    const rightStart = start + hlEnd;

                    clearCore(fileId, clipId); //remove from back end
                    unsub();

                    userEvents.update(ue => {
                        //ue.push({type: 'addClips', clips: [{trackId: trackId, fileId: fileId, start: leftStart, trims: leftTrims}, ]})
                        ue.push({type: 'addClips', clips: [{trackId: trackId, fileId: fileId, start: rightStart, trims: rightTrims}, ]})
                        ue.push({type: "rmClips", clips: [{trackId: trackId, clipId: clipId}, ]})
                        return ue;
                    })

                    const addNewClips = () => {
                        userEvents.update(ue => {
                            ue.push({type: 'addClips', clips: [{trackId: trackId, fileId: fileId, start: leftStart, trims: leftTrims}, ]})
                            //ue.push({type: 'addClips', clips: [{trackId: trackId, fileId: fileId, start: rightStart, trims: rightTrims}, ]})
                            return ue;
                        })
                    }


                    setTimeout(addNewClips, 3)


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

            clip.addEventListener('mouseenter', e => { mouse = true; })
            clip.addEventListener('mouseleave', e => { mouse = false; })
            clip.addEventListener('mousedown', e => mouseDown = true)

            clip.addEventListener('mouseup', e => {
                //isTrimming isMoving etc are reset on the window version of this event listener
                if (mouse) setVerticalPointers(e)
            })
            
            clip.addEventListener('mousemove', e => {

                if (isHighlighting){
                    highlightHandler(e);
                
                }
                
                else if (isMoving){
                    start = updatePosition(e.movementX, start);
                    setCoreTrims(clipTrims, fileId, clipId, start, trackId); 
                }

                else if (isTrimming){
                    clip.style.setProperty('--cursor', 'ew-resize');
                    e.offsetX < clip.offsetWidth * 0.05 && updateTrims(e.movementX, 'left', clipTrims, lineTrims, lineData);
                    e.offsetX > clip.offsetWidth * 0.95 && updateTrims(e.movementX, 'right', clipTrims, lineTrims, lineData);
                }
            
                else if (e.offsetX < clip.offsetWidth * 0.05 || e.offsetX > clip.offsetWidth * 0.95){
                    if (e.srcElement.id != '-mask'){ //make sure we are referencing the clip
                        clip.style.setProperty('--cursor', 'ew-resize');
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
        
        }
        
        else console.error('No Audio Associated With This Clip')
    })

</script>

<div bind:this={clip} class='clip'>
    <div bind:this={_mask} class='mask' id='-mask'></div>
    <div class="line">
        <svg xmlns="http://www.w3.org/2000/svg" height="100%" width="100%" preserveAspectRatio="none" stroke-width='2' viewBox='{vbShift} 0 {vbLength} {vbHeight}'>
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
        position: relative;
        grid-template-rows: 100%;
        box-shadow: 0.06em 0.06em 0.2em 0.09em rgba(163, 142, 168, 0.46);
        height: 89%;
        width: var(--width);
        margin-top: auto;
        margin-bottom: auto;
        left: var(--position);
        /* transform: translateX(var(--position)); */
        background: rgba(177, 177, 177, 0.06);
        cursor: var(--cursor);
        position: absolute;
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


    