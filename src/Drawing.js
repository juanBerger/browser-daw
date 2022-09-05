
import Playhead from './Playhead.svelte'

export const Drawing = {

    scene: null,
    camera: null,
    renderer: null,

    init(canvas, parent) {

        //total track area including meter area (excluding margins)
        const startWidth = Number(window.getComputedStyle(parent).width.split('px')[0]);
        const startHeight = Number(window.getComputedStyle(parent).height.split('px')[0]);

        const scene = new THREE.Scene(); //left, right, top , bottom
        const camera = new THREE.OrthographicCamera(0, startWidth, 0, startHeight, -1, 1);

        const renderer = new THREE.WebGLRenderer( { canvas: canvas, alpha: true, antialias: true } );
        renderer.setSize(startWidth, startHeight);

        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        this.animate();
    },



    drawLine(translateX, translateY, width, height){

        const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
        const material = new THREE.MeshBasicMaterial( {color: 0x00ff00, side: THREE.DoubleSide} );
        const plane = new THREE.Mesh( geometry, material );
        this.scene.add( plane );    
        plane.geometry.translate(translateX + (width * 0.5), translateY + (height * 0.5), 0)

    },


    animate(){

        requestAnimationFrame(this.animate.bind(this));
        this.renderer.render(this.scene, this.camera);

    }


}