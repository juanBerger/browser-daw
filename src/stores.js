import { writable, readable } from 'svelte/store'
import { scaler } from './utils.js'

//export const samplesPerPixel = writable(8000) //this is changed by the zoom setting
//export const zoomStep = readable(384) //change this to an easing function


const MIN_FPP = 25; 
const MAX_FPP = 10000;
const CHANNELS = 2;

function _applyEasing (x) {
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

export const framesPerPixel = _applyEasing();

export const files = writable({})