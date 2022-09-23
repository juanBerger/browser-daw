<script>

    import { onDestroy, onMount} from 'svelte';
    import { framesPerPixel } from './stores.js'
    import { AudioCore } from './audio-utils.js';
    
    let _fpp = 0;

    const fppUnsub = framesPerPixel.subscribe( fpp => _fpp = fpp)

    onMount(() => {
        
        window.addEventListener('keydown', async e => {
            
            if (AudioCore.audioContext.state == 'suspended') await AudioCore.audioContext.resume()
            if (e.key != ' ') return

            AudioCore.awp.port.postMessage({playToggle: true, fpp: _fpp});

        })
    })

    onDestroy(() => {
        fppUnsub();
    })




</script>

