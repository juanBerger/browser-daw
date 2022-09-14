<script>

    import { onDestroy, onMount } from 'svelte';
    import { get } from 'svelte/store'

    import { userEvents } from './stores.js'
    import Clip from './Clip.svelte'

    export let trackId;
    let track;
    const clips = [];
    
    const ueUnsub = userEvents.subscribe(async ue => { 

        for (const [i, event] of ue.entries()){
            if (event.type === 'addClips' || event.type === 'rmClips'){                
                const targetClips = event.clips.filter(clip => clip.trackId === trackId)
                doEvent(targetClips, event.type)
                popEntries(i, targetClips)
            }
        }
    })


    function doEvent(targetClips, type){

        for (const clip of targetClips){

            switch (type) {

                case 'addClips':
                    const newClip = new Clip({ target: track, props: { 
                        fileId: clip.fileId,
                        start: clip.start,
                        clipTrims: clip.trims,
                        trackId: trackId,
                        clipId: clips.length
                    }})

                    clips.push(newClip)
                    break;
                
                case 'rmClips':
                        const rmClip = document.getElementById(clip.clipId)
                        track.removeChild(rmClip)

                    break;

            }

        }

    }


    function popEntries(i){

        userEvents.update(ue => { 

            for (const [j, clip] of ue[i].clips.entries()){
                if (clip.trackId === trackId)
                    ue[i].clips.splice(j, 1)
            } 

            if (ue[i].clips.length === 0)
                ue.splice(i, 1);

            return ue

        })


    }

    // function popUe (i){
    //     userEvents.update(e => {
    //         e.splice(i, 1);
    //         return e
    //     })
    // }

    onMount(() => {

        track.id = trackId;
        console.log('Track On Load', trackId)

    })

    onDestroy(() => {
        ueUnsub();
    })

</script>

<div bind:this={track} class='trackRow track'></div>


<style>

    .trackRow.track {
        /* display: flex; */
        position: relative;
        border-bottom: 1px solid rgba(249, 206, 201, 0.373);
    }

</style>


