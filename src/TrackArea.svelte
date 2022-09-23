<script>

    import { onDestroy, onMount } from 'svelte';
    import { get } from 'svelte/store'

    import { framesPerPixel, userEvents } from './stores.js'

    import Track from './Track.svelte'
    import Meter from './Meter.svelte'
    import Playhead from './Playhead.svelte'
    import { AudioCore } from './audio-utils.js';

    let trackArea;
    const tracks = []; //this component is in charge of assigning track ids. It reuses indeces from this array

    const ueUnsub = userEvents.subscribe(async ue => {
        
        for (const [i, event] of ue.entries()){   
            if (event.type === 'addTrack'){
                
                const track = new Track({
                    target: trackArea,
                    props: {
                        trackId: tracks.length, //we are just using the indexes here as trackIds
                    }
                })

                
                popUserEvent(i);
                
                if (event.clips){
                    userEvents.update(ue => {
                        event.clips.map(clip => clip.trackId = tracks.length);
                        ue.push({type: 'addClips', clips: event.clips});
                        return ue
                    })
                }

                console.log('Pushed Add Clip Event')
                tracks.push(track)
            }
        }

      

    })

    function popUserEvent(i){
        userEvents.update(e => {
            e.splice(i, 1);
            return e
        })
    }


    onMount(async () => {
        resObs.observe(trackArea);

    })

    onDestroy(() => {
        ueUnsub();
        cvsUnsub();
    })

    const resObs = new ResizeObserver(e => {
        console.log(e[0].borderBoxSize[0].inlineSize, e[0].borderBoxSize[0].blockSize);
        AudioCore.awp.port.postMessage({resize: {type: 'playhead', width: e[0].borderBoxSize[0].inlineSize, height: e[0].borderBoxSize[0].blockSize}})
    })


</script>

    <div bind:this={trackArea} id='trackArea'>
        <canvas id='playCanvas'></canvas>
        <Playhead/>
    </div>

<style>

    #trackArea {
        --trackArea-width: 0px;
        position: relative;
        grid-row-start: 3;
        grid-column-start: 3;
        display: flex;
        flex-direction: column;
        /* margin-left: 0.8em;
        margin-right: 0.8em; */
      
    }


    #playCanvas {
        box-sizing: border-box;
        position: absolute;
        z-index: -100;
    }

</style>









































