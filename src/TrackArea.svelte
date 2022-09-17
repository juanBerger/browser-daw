<script>

    import { onDestroy, onMount, tick } from 'svelte';
    import { get } from 'svelte/store'

    import { framesPerPixel, userEvents } from './stores.js'

    import Track from './Track.svelte'
    import Meter from './Meter.svelte'
    import Playhead from './Playhead.svelte'

    let trackArea;
    let zoomStep = 3; // 0 to 30 --> as this gets higher polyline height should somehow get smaller
    let playheadHeight = 0;

    const tracks = []; //this component is in charge of assigning track ids. It reuses indeces from this array
    const SR = 48000;
    const NUM_HOURS = 1;

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

        //  S E T    M A X    W I D T H   //
        let totalSamples = SR * 60 * 60 * NUM_HOURS
        framesPerPixel.ease(zoomStep)
        let pixelWidth = String(Math.round(totalSamples / get(framesPerPixel)))
        trackArea.style.setProperty('--trackArea-width', pixelWidth + 'px')

    })

    onDestroy(() => {
        ueUnsub();
    })


</script>

    <div bind:this={trackArea} id='trackArea'>
        <!-- {#if _this}
            <Playhead height={playheadHeight}/>
        {/if} -->
    </div>

<style>

#trackArea {
    --trackArea-width: 0px;
    position: relative;
    grid-row-start: 3;
    grid-column-start: 3;
    display: flex;
    flex-direction: column;
    margin: 0.8em;
    width: var(--trackArea-width);
}

</style>









































