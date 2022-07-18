<script>

import Track from './Track.svelte'

let idCounter = 0; //replace with something else later
let tracks = []


let mouseCheck = () => {
    
    // for (const id in tracksObj){
    //     if (tracksObj[id].$$.props.mouse){
    //         tracksObj[id].addClip('mouseYPositionNeeded', audioBuffer)
    //         return true
    //     }
    // }


}


export function update(trackArea, audioBuffer) { 

    //overCheck
    tracks.push({id: idCounter, instance: null})
    tracks = tracks //let svelte know that this array has changed


    //if track does not exist create a new one and call addClip on it
    // const track = new Track({
    //     target: trackArea,
    //     props: {
    //         id: idCounter,
    //         audioBuffer: audioBuffer
    //     }
    // })

   
    // track.addClip('mouseYPositionNeeded', audioBuffer)
    // tracksObj[idCounter] = track
    // idCounter++
    // return true
}

</script>

