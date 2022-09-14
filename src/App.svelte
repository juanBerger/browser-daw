<script>

    import { onMount, onDestroy } from 'svelte';

    import {userEvents } from './stores.js';

    import TrackArea from './TrackArea.svelte';
    import LeftArea from  './LeftArea.svelte';
    import Header from './Header.svelte';

    import { Loaders } from './Loaders.js';
    import { AudioCore } from './audio-utils.js';

    const LOAD_OPTION = 'auto';

    /**
     * events --> add Track (can be with or without clips if withclips need to pass in handle?)
     */
    const ueUnsub = userEvents.subscribe(ue => {
        
    })

    onMount(async () => {

        await AudioCore.create();
        if (LOAD_OPTION = 'auto')
            Loaders.auto();
    })

    onDestroy(() => {
        ueUnsub();
    })


</script>


<div id='app'>
    <LeftArea/>
    <div id='vDivider'/>
    <Header/>
    <div id='hDivider'/>
    <TrackArea/>
</div>


<style>

    #app {
        display: grid;
        grid-template-columns: minmax(100px, 1fr) 1px 8fr;
        grid-template-rows: 18vh 1px 78vh; 
        overflow: auto;
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