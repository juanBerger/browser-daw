// Set up stores to add files, clips and tracks. Pointers create relationships from one category to another

// function createFiles() {
    
//     function createPoints(arrayBuffer, h) {

//         if (arrayBuffer.byteLength > 0){
            
//             const audio = new Int16Array(arrayBuffer.slice(44, arrayBuffer.byteLength)) //just int16 for now
//             let lastY = 0;
//             let points = ''
//             //let points = []s
//             let yMultiple = 1;
//             let zoom = 50; //max density
//             zoom % 2 != 0 ? zoom++ : zoom = zoom //left channel only

//             //make this a more economical data type?
//             for (let i=0; i < audio.length; i += zoom){ //zoom level is reflected here probably
//                 let scaled = scaler(audio[i], -32768, 32767, 0, h)
//                 points += String(lastY) + ',' + String(scaled) + ' '
//                 lastY += yMultiple        
//             }
        
//             return points
//         }

//         else return null
//     }
    
    
//     const {set, update, subscribe} = writable({}) //destructures the writable into its component parts
//     return {
//         set,
//         update,
//         subscribe,
//         addFile: (arrayBuffer, h) => {
//             //let id = Math.floor(Math.random() * (10 - 0 + 1)) + 0 //fake uuid--> https://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range
//             let id = 0
//             let points =  createPoints(arrayBuffer, h)
//             let entry = {data: arrayBuffer, waveform: points}
//             update(Files => {
//                 Files[id] = entry
//                 return Files
//             })
//         }
//     }
// };
    
// export const Files = createFiles()



// function createTrack(){

//     const {set, update, subscribe} = writable([])
    

//     return {

//         set,
//         update,
//         subscribe,
//         addTrack: () => {

//         }
//     }



// }

// export const Tracks = createTrack()