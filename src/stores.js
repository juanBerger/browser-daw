import { writable, readable } from 'svelte/store'
import { scaler } from './utils.js'

//export const samplesPerPixel = writable(8000) //this is changed by the zoom setting
//export const zoomStep = readable(384) //change this to an easing function


//** ISSUES */
const MIN_SPP = 25; 
const MAX_SPP = 10000;
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
            let scaled = Math.round(scaler(eased, 0, 30, MIN_SPP, MAX_SPP))
            // console.log(scaled, x)
            set(scaled)
            
        },
        subscribe
    }
}

export const samplesPerPixel = _applyEasing();

export const files = writable({})