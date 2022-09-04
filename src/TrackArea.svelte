<script>

import { onMount } from "svelte";
import { AudioCore } from './audio-utils.js'
import { framesPerPixel } from './stores.js'
import { get } from 'svelte/store'
import { uuidv4 } from './utils.js';

import Track from './Track.svelte'

let _this;
let _canvas;
let _zoomStep = 15; // 0 to 30 --> as this gets higher polyline height should somehow get smaller
let scene;
let camera;
let renderer;

let SR = 48000
let NUM_HOURS = 1

function animate(){
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}



onMount(()=> {

    let totalSamples = SR * 60 * 60 * NUM_HOURS;
    AudioCore.totalSamples = totalSamples;
    framesPerPixel.ease(_zoomStep);
    let pixelWidth = String(Math.round(totalSamples / get(framesPerPixel)));

    const testWidth = String(window.innerWidth);
    _this.style.setProperty('--trackArea-width', testWidth + 'px');

    let startWidth = Number(window.getComputedStyle(_this).width.split('px')[0]);
    let startHeight = Number(window.getComputedStyle(_this).height.split('px')[0]);

    console.log(startWidth, startHeight)

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(startWidth / -2, startHeight / 2, startWidth / 2, startHeight / -2, 0.1, 1000 ); //left, right
    camera.position.z = 100;

    const geometry = new THREE.BoxBufferGeometry(100,100,100);
    const material = new THREE.MeshNormalMaterial();

    const mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh );

    renderer = new THREE.WebGLRenderer( { 
        canvas: _canvas,
        alpha: true,
        antialias: true } );
    renderer.setSize( startWidth, startHeight );
    _this.appendChild( renderer.domElement );

    animate();

    let trackId = uuidv4();
    const track = new Track({
        target: _this,
        props: {
            fileId: '123',
            trackId: trackId,
            parent: _this
        }
    })

})


</script>


<div bind:this={_this} id='trackArea'>
    <canvas bind:this={_canvas} id="canvas"/>
    <!-- {#if _this}
        <Playhead height={playheadHeight}/>
    {/if} -->
</div>

<style>


#test {
    width: 100%;
    height: 100%;
    visibility: hidden;
}

#canvas {

    position: absolute;

}

#trackArea {

    --trackArea-width: 0;
    position: relative;
    grid-row-start: 3;
    grid-column-start: 3;
    display: flex;
    flex-direction: column;
    margin: 0.8em;
    width: var(--trackArea-width);
}

</style>

