<script>

    import { AudioCore } from './audio-utils.js';
    import { Drawing } from './Drawing.js';
    import { onMount } from 'svelte';
    // import { uuidv4 } from './utils.js';

    export let fileId;
    export let trackId;
    export let parent;
    export let translateX;

    let clip;
    let clipId;
    const DARK_MATTER_OFFSET = 8.75;
    let drawGroup;


    onMount(async () => {   
        
        clipId = '678'

        const clipArea = document.getElementById("clipArea")
        const marginLeft = Number(window.getComputedStyle(clipArea).marginLeft.split('px')[0])
        console.log(clipArea.clientWidth, marginLeft)
        const fullWidth = clipArea.clientWidth - marginLeft
        
        clip.style.setProperty('width', String(fullWidth) + 'px');
        const lineData = await AudioCore.getWaveform(fileId); //get waveform from back end        
        clip.style.setProperty('--translateX', String(translateX) + 'px');
        
        const boundingRect = clip.getBoundingClientRect();
        drawGroup = Drawing.createGroup(boundingRect.x - DARK_MATTER_OFFSET, boundingRect.y - DARK_MATTER_OFFSET, clip.clientWidth, clip.clientHeight, lineData); 
        clip.style.setProperty('visibility', 'visible');

        AudioCore.awp.port.postMessage({trims: {fileId: fileId, clipId: clipId, trackId: trackId, meta: [0, 0, 0]}}) //metas: [position, trimLeft, trimRight]
        //setCoreTrims(clipTrims, fileId, clipId, start, trackId); 
        
    })


</script>

    <div bind:this={clip} id='clip'></div>

<style>
    
    #clip {

        --translateX: 0px;
        
        display: grid;
        box-shadow: 0.06em 0.06em 0.2em 0.09em rgba(163, 142, 168, 0.46);
        height: 89%;
        margin-top: auto;
        margin-bottom: auto;
        transform: translateX(var(--translateX));
        background: rgba(177, 177, 177, 0.06);
        visibility: hidden;


    }
    
</style>




