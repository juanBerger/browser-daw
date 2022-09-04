import './styles.css'
import TrackArea from './TrackArea.svelte'
// import LeftArea from  './LeftArea.svelte'
import Header from './Header.svelte'

window.onload = e => {
    const app = document.getElementById('app');
    const header = new Header({target: app});

    // const leftArea = new LeftArea({target: app})
    const trackArea = new TrackArea({ target: app})
    
}




//This is for a file dialogue
// const readFile = async () => {
//     const [handle] = await window.showOpenFilePicker({
//         types: [{ description: 'Pro Tools Session Files', accept: {'application/octet-stream': ['.wav']}}],
//         startIn: 'desktop'}) 
//     const file = await handle.getFile()
//     const buffer = await file.arrayBuffer()
//     return buffer
// }
