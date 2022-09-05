<script>

    import { Drawing } from './Drawing.js';
    import { onMount } from 'svelte';

    export let translateX;
    export let parentTrack;

    let clip;

    onMount(() => {

        clip.style.setProperty('--translateX', String(translateX) + 'px');
        const boundingRect = clip.getBoundingClientRect();
        Drawing.drawLine(boundingRect.x - 8.75, boundingRect.y -8.75, clip.clientWidth, clip.clientHeight); //up to border (non inclusive)
    })


</script>

    <div bind:this={clip} id='clip'></div>

<style>
    
    #clip {

        --translateX: 0px;
        
        display: grid;
        /* grid-template-rows: 100%; */
        box-shadow: 0.06em 0.06em 0.2em 0.09em rgba(163, 142, 168, 0.46);
        height: 89%;
        width: 500px;
        margin-top: auto;
        margin-bottom: auto;
        transform: translateX(var(--translateX));
        background: rgba(177, 177, 177, 0.06);


    }
    
</style>




