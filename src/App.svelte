<script>

    import { onMount, onDestroy } from 'svelte';
    import { get } from 'svelte/store'
    import {userEvents, framesPerPixel } from './stores.js';

    import TrackArea from './TrackArea.svelte';
    import LeftArea from  './LeftArea.svelte';
    import Header from './Header.svelte';

    import { Loaders } from './Loaders.js';
    import { AudioCore } from './audio-utils.js';

    const SR = 48000;
    const NUM_HOURS = 0.1;
    let ZOOM_STEP = 10; // 0 to 30 --> as this gets higher polyline height should somehow get smaller
    const LOAD_OPTION = 'auto';

    const audioBuffers = [];

    let app;

    onMount(async () => {

        setSize(true, true);

        if (LOAD_OPTION = 'auto')
           Loaders.auto(audioBuffers);

    })

    onDestroy(() => {
        ueUnsub();
    })

    addEventListener('resize', e => {
        setSize(false, true);
    })

    window.addEventListener('keydown', e => {
        
        if (e.key === '-' || e.key === '_')
            ZOOM_STEP++
    
        else if (e.key === '+' || e.key === '=')
            ZOOM_STEP--
        
        framesPerPixel.ease(ZOOM_STEP);
    });

    const setSize = (setWidth, setHeight) => {

        if (setWidth){
            let totalSamples = SR * 60 * 60 * NUM_HOURS;
            framesPerPixel.ease(ZOOM_STEP)
            let pixelWidth = String(Math.round(totalSamples / get(framesPerPixel)))
            app.style.setProperty('--app-width', pixelWidth + 'px')
            
        }

        if (setHeight){
            const height = String(window.innerHeight - (18 + 15));
            app.style.setProperty('--app-height', height + 'px')
        }
    }


</script>


<div bind:this={app} id='app'>
    
    <LeftArea/>
    <div id='vDivider'/>
    <Header/>
    <div id='hDivider'/>
    <TrackArea/>

</div>


<style>

    #app {    
        --app-width: 0px;
        --app-height: 0px;
        display: grid;
        grid-template-columns: 130px 1px 1fr;
        grid-template-rows: 1fr 1px 6fr;
        width: var(--app-width);
        height: var(--app-height);
        border: 1px solid rgb(255, 205, 238, 0.6);

    }

    #vDivider {
        grid-column-start: 2;   
        grid-row: 1/-1;
        height: 99%;
        margin: auto;
        border-right: 1px dotted grey; 
    }


    #hDivider {
        grid-row-start: 2;
        grid-column: 1/-1;
        width: 100%;
        margin: auto;
        border-bottom: 1px dotted grey; 
    }

</style>