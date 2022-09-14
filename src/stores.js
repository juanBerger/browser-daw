import { writable } from 'svelte/store'
import { scaler } from './utils.js'
import { AudioCore } from './audio-utils.js'

const MIN_FPP = 25; 
const MAX_FPP = 10000;
const CHANNELS = 2;

function applyEasing (x) {
    const { set, update, subscribe } = writable(x);
    return {
        set,
        update, 
        ease: (x) => {
           
            //x *= 0.1
            //let eased = -(Math.cos(Math.PI * x) - 1) / 2
            //let eased = x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
            //this needs to get much slower as it gets closer to MIN_SPP
            let eased = x
            let scaled = Math.round(scaler(eased, 0, 30, MIN_FPP, MAX_FPP))
            //scaled % CHANNELS === 0 ? scaled = scaled : scaled += scaled 
            scaled /= CHANNELS
            console.log('[CURRENT FPP]...', scaled)
            set(scaled)
            
        },
        subscribe
    }
}

export const framesPerPixel = applyEasing();
export const currentFrame = writable(0); //Not sure we need this
export const isPlaying = writable(false);
export const userEvents = writable([]);

//dont need this cause I have the dom?
export const tcState = writable({
    nextId: 0,
    tracks: {} //{trackId: []}
});



const unsub = currentFrame.subscribe(frame => {
    if (AudioCore.awp){
        AudioCore.awp.port.postMessage({snap: frame})
    }
});

AudioCore.registerCallback(e => {
    if (e.data.tick) currentFrame.set(e.data.tick)
});
