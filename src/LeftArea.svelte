
<script>
    
    import { framesPerPixel, userEvents } from './stores.js'
    import { onDestroy, onMount } from 'svelte';
    import { AudioCore } from './audio-utils.js';

    let leftArea;

    const ueUnsub = userEvents.subscribe(ue => {
            
        for (const [i, event] of ue.entries()){   
            if (event.type === 'addTrack'){

                
                // const track = new Track({
                //     target: trackArea,
                //     props: {
                //         trackId: tracks.length, //we are just using the indexes here as trackIds
                //     }
                // })
                
                // AudioCore.awp.port.postMessage({addTrack: tracks.length})
                // popUserEvent(i);
                
                // if (event.clips){
                //     userEvents.update(ue => {
                //         event.clips.map(clip => clip.trackId = tracks.length);
                //         ue.push({type: 'addClips', clips: event.clips});
                //         return ue
                //     })
                // }

                // console.log('Pushed Add Clip Event')
                // tracks.push(track)
            }
        
        
        }

    })

    const resObs = new ResizeObserver(e => {
        AudioCore.awp.port.postMessage({resize: {type: 'leftArea', width: e[0].borderBoxSize[0].inlineSize, height: e[0].borderBoxSize[0].blockSize}})
    })

    onMount(() => {
        resObs.observe(leftArea)
    })

    onDestroy(() => {
        ueUnsub();
    })


</script>

<div bind:this={leftArea} class='leftArea'>
    <canvas id='leftCanvas'></canvas>
</div>

<style>

.leftArea {

    grid-row-start: 3;
    grid-column-start: 1;
    grid-column-end: 2;
    display: flex;
    flex-direction: column;
    margin-top: 0.8em;
    margin-bottom: 0.8em;
    margin-left: 0.3em;
    margin-right: 0.1em;
}

#leftCanvas {
    width: 100%;
    height: 100%;
}

    
</style>