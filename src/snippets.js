

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
