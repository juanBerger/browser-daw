<script>

    import { onMount } from "svelte";
    import { AudioCore } from './audio-utils.js';
    import { Drawing } from './Drawing.js';
    import { uuidv4 } from './utils.js';

    import Track from './Track.svelte'
    import Playhead from "./Playhead.svelte";

    let trackArea;
    let mouse;

    // window.onclick = async () => {

    //     let audioBuffer, file;
    //     [ audioBuffer, file ] = await readFile();
    //     let fileId = await AudioCore.addFile(audioBuffer, file.name.split('.wav')[0])
    //     let trackId = uuidv4();
    //     const track = new Track({
    //         target: trackArea,
    //         props: {
    //             fileId: fileId,
    //             trackId: trackId,
    //             parent: trackArea,
    //         }
    //     })

    // }


    const readFile = async () => {
    
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: '16 bit .wav file', accept: {'application/octet-stream': ['.wav']}}],
            startIn: 'desktop'}) 
        const file = await handle.getFile()
        const buffer = await file.arrayBuffer()
        return [buffer, file]
    }

    //need a get request probably to load files automatically
    onMount(async ()=> {  

        await AudioCore.create();

        const clipArea = document.getElementById('clipArea')
        console.log(clipArea)

        Drawing.init(document.getElementById('sceneCanvas'), document.getElementById('app'))

        trackArea.addEventListener('mouseenter', e => mouse = false)
        trackArea.addEventListener('mouseleave', e => mouse = false)
       
        trackArea.addEventListener('dragover', e => { e.preventDefault() })
        trackArea.addEventListener('drop', async e => {

            e.preventDefault()

            let handles = Array.from(e.dataTransfer.items)
                .filter(handle => handle.type.includes('audio'))
                .map(handle => handle.getAsFileSystemHandle())

            for await (const handle of handles){
                const file = await handle.getFile()
                const audioBuffer = await file.arrayBuffer()
                if (audioBuffer.byteLength > 0){
                    if (!AudioCore.awp) await AudioCore.create()
                    else if (AudioCore.audioContext.state === 'suspended'){
                        await AudioCore.audioContext.resume()
                        console.log(AudioCore.audioContext.state)
                    }
                    
                    let fileId = await AudioCore.addFile(audioBuffer, file.name.split('.wav')[0])
                    if (fileId !== null) {
                        let trackId = uuidv4();
                        const track = new Track({
                            target: trackArea,
                            props: {
                                fileId: fileId,
                                trackId: trackId,
                                parent: trackArea,
                            }
                        })
                    }
                }
            }
    })




    })


</script>
    <div id='clipArea'/>
    <div bind:this={trackArea} id='trackArea'>
        <Playhead></Playhead>
    </div>
<style>


#clipArea {
    grid-row-start: 3;
    grid-column-start: 3;
    margin: 0.8em;
    background-color: rgba(36, 36, 36, 0.59);
    border-radius: 10px;

}

#trackArea {

    grid-row-start: 3;
    grid-column: 1 / 4;

    display: flex;
    flex-direction: column;
    margin: 0.8em;

}

</style>

