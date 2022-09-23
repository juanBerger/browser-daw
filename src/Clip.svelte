
<script>

    import { onMount, createEventDispatcher, tick, afterUpdate } from 'svelte';


    import { get } from 'svelte/store';
    import {framesPerPixel, userEvents, lineDataStore} from './stores';

    import { AudioCore } from './audio-utils.js'

    export let fileId; //what is the backing audio file id
    export let start; //start position on the timeline in pixels
    export let clipTrims; //left and right trims in frames
    export let trackId; //this gets added to the metas
    export let track;
    export let clipId;


    //* DOM Elements *//
    let clip;
    let mask;
    let line;
    let ltrim;
    let rtrim;
    
    //* DOM Attributes *//
    let points = '';
    let lineData;
    let vbLength = 0; //the polyline creates a new point at each pixel
    let vbHeight = 0;
    let vbShift = '0';
    let maxSvgWidth = 0;

    /* Mouse states */
    let mouse = null;
    let mouseDown = false;
    let mouseUp = false;

    /* Actions */
    let isTrimming = false;
    let isTrimmingLeft = false;
    let isTrimmingRight = false;

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
        //!lastfpp ? lastfpp = fpp : zoom();
    });

    const dispatch = createEventDispatcher();

    onMount(() => {
        
        if (fileId !== null){
            
            clip.id = clipId; //tag the DOM element with our passed in ID
            
            lineData = get(lineDataStore)[fileId]
            
            vbHeight = String(lineData.height); //an arbitrary nmber of pixels since height is scaled to conatiner box. Higher values create lighter looking lines
            vbLength = String(lineData.points.length); //this is really already in pixel space because each point increments by one pixel (its 1px per 'density' number of samples)
            maxSvgWidth = framesToPixels(lineData.sampleLength / lineData.channels, get(framesPerPixel));

            let lineTrims = clipTrimsToLineTrims(clipTrims, lineData);
            updateTrims(0, 'left', clipTrims, lineTrims, lineData);
            updateTrims(0, 'right', clipTrims, lineTrims, lineData);

            window.addEventListener('mousedown', e => {
                
                mouseDown = true

                //reset any highlights
                mask.style.setProperty('--opacity', 0);
                mask.style.setProperty('--position', String(hlStart) + 'px');
                mask.style.setProperty('--width', '0px');
                hlStart = 0;
                hlEnd = 0;

            })

            // //reset flags here since we may be outside of the clip
            window.addEventListener('mouseup', () => {
                
                mouseDown = false;
                //isTrimming = false;
                isTrimmingLeft = false;
                isTrimmingRight = false;
                isMoving = false;
                isHighlighting = false; //the highlight may still be visible, but it is no longer changing
                firstHighlight = true;
            
            })

            track.addEventListener('mousemove', e => {

                if (isTrimmingLeft){
                    updateTrims(e.movementX, 'left', clipTrims, lineTrims, lineData);
                }

                else if (isTrimmingRight){
                    updateTrims(e.movementX, 'right', clipTrims, lineTrims, lineData);
                }

                else if (isMoving){
                    start = updatePosition(e.movementX, start);
                    setCoreTrims(clipTrims, fileId, clipId, start, trackId);
                }
            })

            
            line.addEventListener('mousemove', e => {
                
                //console.log('Line ', e.target)
                
                if (isHighlighting) 
                    highlightHandler(e);

                else {

                    if (isMoving || isHighlighting || isTrimmingLeft || isTrimmingRight)
                        return
                    
                    let type = setVerticalPointers(e);
                    if (mouseDown){
                        if (type === 'grab') {
                            isMoving = true;
                            dispatch('isMoving', {value: true, clipId: clipId})
                        }
                        else if (type === 'text') {
                            isHighlighting = true;
                        }
                    }

                }

            })

        
            // svg.addEventListener('mousemove', e => {
            //     e.stopPropagation();
            // });



            ltrim.addEventListener('mousemove', (e) => {
                
                //console.log('LTrim ', e.target)

                if (isMoving || isHighlighting){
                    return
                }
                    

                clip.style.setProperty('--cursor', 'ew-resize');
                if (mouseDown){
                    isTrimmingLeft = true;
                }
            });

            rtrim.addEventListener('mousemove', (e) => {
                
                if (isMoving || isHighlighting)
                    return
                
                clip.style.setProperty('--cursor', 'ew-resize');
                if (mouseDown){
                    isTrimmingRight = true;
                }
            });
            
            window.addEventListener('keydown', e => {
                
                if(e.key === 'Backspace' && (Math.abs(hlStart - hlEnd) > 0)){

                    const clipLength = Number(window.getComputedStyle(clip).getPropertyValue('--width').split('px')[0])
                    const fpp = get(framesPerPixel);
                    
                    const leftTrims = [clipTrims[0], clipTrims[1] + pixelsToFrames(clipLength - hlStart, fpp)]
                    const leftStart = start;

                    const rightTrims = [clipTrims[0] + pixelsToFrames(hlEnd, fpp), clipTrims[1]]
                    const rightStart = start + hlEnd;

                    clearCore(fileId, clipId);
                    unsub();

                    userEvents.update(ue => {
                        ue.push({type: 'addClips', clips: [{trackId: trackId, fileId: fileId, start: leftStart, trims: leftTrims}, ]})
                        ue.push({type: 'addClips', clips: [{trackId: trackId, fileId: fileId, start: rightStart, trims: rightTrims}, ]})
                        ue.push({type: "rmClips", clips: [{trackId: trackId, clipId: clipId}, ]})
                        return ue;
                    })

                }
            })
        
        }
        
        else console.error('No Audio Associated With This Clip')
    })


    

    const updateTrims = (pixelChange, side, clipTrims, lineTrims, lineData) => {

        if (side === 'left'){
            let lNewClipTrim = clipTrims[0] + pixelsToFrames(pixelChange, get(framesPerPixel));
            if (lNewClipTrim < 0) return;
            clipTrims[0] = lNewClipTrim;
            
            let lNewLineTrim = lineTrims[0] + pixelsToLinePoints(pixelChange, get(framesPerPixel), lineData);
            if (lNewLineTrim < 0) return;
            lineTrims[0] = lNewLineTrim
            
            //Trimming from left requires shifting clips to the right (since length itself can only be changed from the right)
            start = updatePosition(pixelChange, start); //this a
            vbShift = String(Number(lineTrims[0]));  
        }

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

    const setVerticalPointers = (e) => {
        
        let pointerType;
        
        if (e.offsetY > clip.offsetHeight / 2){ 
            clip.style.setProperty('--cursor', 'grab')
            pointerType = 'grab'
        }
        else {
            pointerType = 'text'
            clip.style.setProperty('--cursor', 'text')
        }
        
        return pointerType
    }

    const highlightHandler = e => {
        
        if (firstHighlight){
            mask.style.setProperty('--opacity', 0.3)
            firstHighlight = false;
            hlStart = e.offsetX
            hlEnd = hlStart
            mask.style.setProperty('--position', String(hlStart) + 'px')
            return
        }
        
        hlEnd += e.movementX
        let delta = Math.abs(hlEnd - hlStart)
        if (hlEnd < hlStart){
            mask.style.setProperty('--position', String(hlStart - delta) + 'px')
        }

        mask.style.setProperty('--width', String(delta) + 'px')
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
        start += pixelChange;
        clip.style.setProperty('--position', start + 'px');
        return start
    }


    const updateWaveform = (lineTrims, lineData) => {
        const subArray = lineData.points.slice(lineTrims[0], (lineData.points.length - lineTrims[1]));
        //vbLength = String(subArray.length)
        points = subArray.join(' ');
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
        //const totalFrames = frames.reduce((prev, current) => prev + current);
        return Math.round(frames / fpp);
    }

    const pixelsToFrames = (pixels, fpp) => {
        return Math.round(pixels * fpp);
    }

    const setCoreTrims = (clipTrims, fileId, clipId, position, trackId) => {
        //clipTrims[0] -= 12000 //everything is a little off lol 
        //clipTrims = clipTrims.map(ct => ct * 1);
        AudioCore.awp.port.postMessage({trims: {fileId: fileId, clipId: clipId, trackId: trackId, meta: [position * get(framesPerPixel), clipTrims[0], clipTrims[1]]}})
    }

    const clearCore = (fileId, clipId) => {
        AudioCore.awp.port.postMessage({clear: {fileId: fileId, clipId: clipId}});
    }

</script>


<div bind:this={clip} class='clip'>

    <div bind:this={ltrim} class='trimAreas' id="ltrim"/>
    <div bind:this={rtrim} class='trimAreas' id="rtrim"/>
    <div bind:this={mask} class='mask' id='-mask'></div>
    <div bind:this={line} class="line">
        <svg id="svg" xmlns="http://www.w3.org/2000/svg" height="100%" width={maxSvgWidth} preserveAspectRatio="none" stroke-width='2' viewBox='{vbShift} 0 {vbLength} {vbHeight}'>
           <polyline id="pl" stroke='white' points={points} fill='none'/>
        </svg>
    </div>
</div>


<style>

    .clip {

        --position: 0px;
        --cursor: auto;
        --width: 0px;
        
        /* display: grid; */
        position: absolute;
        grid-template-rows: 100%;

        box-sizing: content-box;
        height: 89%;
        width: var(--width);
        left: var(--position);

        margin-top: 0.45em;
        margin-bottom: 0.45em;

        box-shadow: 0.06em 0.06em 0.2em 0.09em rgba(163, 142, 168, 0.46);
        background: rgba(177, 177, 177, 0.06);
        cursor: var(--cursor);
        
    }

    .trimAreas {

        position: absolute;
/*         
        grid-row-start: 1;
        grid-column-start: 1; */
        
        width: 25px;
        /* width: 15px; */
        height: 100%;
       
        z-index: 100;

        /* background: rgba(245, 222, 179, 0.504); */

    }


    #ltrim {
        left: -5px;
    }

    #rtrim {
        right: -5px;
    }

    .line {

        /* grid-row-start: 1;
        grid-column-start: 1; */
        position: absolute;
        width: 100%;
        height: 100%;

    }

    #pl, #svg {
        pointer-events: none;
    }

    .mask {

        --opacity: 0;
        --position: 0px;
        --width: 0px;

        position: absolute;

        width: var(--width);
        /* transform: translateX(var(--position)); */
        left: var(--position);
        height: 98%;
        /* grid-row-start: 1;
        grid-column-start: 1; */
        background: rgba(209, 213, 255, var(--opacity)); /*up to 0.2 maybe*/

    }


    
</style>


    