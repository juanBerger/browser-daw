

//update this to work on fire fox
// async function buttonClicked(e){
    
//     const fileObj = await readFile()
//     if (fileObj[0].byteLength > 0){

//         if (!AudioCore.awp) await AudioCore.create()

//         else if (AudioCore.audioContext.state === 'suspended'){
//             await AudioCore.audioContext.resume()
//             console.log(AudioCore.audioContext.state)
//         }

//         //this is like a function call which we will await -- success = unique id. AWP determined if dup or not
//         let id = await AudioCore.addFile(fileObj[0], fileObj[1].name.split('.wav')[0])
        
//         if (id !== null) {
//             //if (hovering over existing track){
//                 //add to that track
//             //}
//             //else:
//             const track = new Track({
//                 target: _this,
//                 props: {
//                     fileId: id //could be multiple?
//                 }
//             })
//         }

//     }

// }





    // const handlePlayHeadMessage = e => {
        
        
    //     if (e.data.tick){
    //         if (e.data.tick - lastSampleValue >= (get(framesPerPixel)) && isPlaying){
    //             pixelPosition = Math.round(e.data.tick / get(framesPerPixel)) 
    //             updateStyle()
    //             lastSampleValue = e.data.tick
    //         }
    //     }


    //     // else if (e.data.snap){
    //     //     pixelPosition = Math.round(e.data.snap / get(framesPerPixel))
    //     //     updateStyle()
    //     //     console.log(e.data.snap)
    //     //     lastSampleValue = e.data.snap
    //     // }
      
    // }

    // AudioCore.registerCallback(handlePlayHeadMessage);






    


    // const updateStyle = (pixelPosition) => _this.style.setProperty('--playhead-pos', pixelPosition + 'px');

// const unsub = currentFrame.subscribe(frame => {
//     let pixelPosition = frame / get(framesPerPixel);
//     console.log(pixelPosition)
//     if (_this){
//         updateStyle(pixelPosition);
//     }
// });


// onDestroy(() => {unsub();})

onMount(async () => {

    //* PLAYHEAD *//
    document.addEventListener('keydown', async e => {

        //In this case - no clips have been added
        if (!AudioCore.awp) await AudioCore.create()
        
        if (AudioCore.audioContext.state === 'suspended') await AudioCore.audioContext.resume()
    
        if (e.key != ' ') return
                
        let playState = 'stop'
        if (!isPlaying){
            isPlaying = true;
            playState === 'play';
        }

        let startPos = get(currentFrame);
        if (modifierKey){
            startPos = 0
            currentFrame.set(0)
            updateStyle()
        }

        //AudioCore.awp.port.postMessage({playState: playState, startPos: startPos});
           
    })

})