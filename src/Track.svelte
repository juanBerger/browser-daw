<script>

    import { userEvents } from './stores.js'
    import { onDestroy, onMount } from 'svelte';
    import Clip from './Clip.svelte'

    export let trackId;
    let track;
    
    const ueUnsub = userEvents.subscribe(async ue => { 

        for (const [i, event] of ue.entries()){
            
            if (event.type === 'addClips' && event.trackId === trackId){
                
                //event.clips: [{fileId: fileId, start: 0, trims: [0, 0]}, ]
                for (const clip of event.clips){
                    
                    const c = new Clip({
                        target: track,
                        props: {
                            fileId: clip.fileId,
                            start: clip.start,
                            clipTrims: clip.trims,
                            trackId: trackId
                        }
                    })
                }
            
                popUserEvent(i);
            
            }

        }
    })


    function popUserEvent(i){
        userEvents.update(e => {
            e.splice(i, 1);
            return e
        })
    }

    onMount(() => {
        console.log('Track On Load')

    })

    onDestroy(() => {
        ueUnsub();
    })

</script>

<div bind:this={track} class='trackRow track'></div>


<style>

    .trackRow.track {
        display: flex;
        border-bottom: 1px solid rgba(249, 206, 201, 0.373);
    }

</style>


