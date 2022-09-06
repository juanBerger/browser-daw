
import Playhead from './Playhead.svelte'
import * as THREE from 'three';
import { MeshLine, MeshLineMaterial, MeshLineRaycast } from 'three.meshline';
import { scaler } from './utils';

export const Drawing = {

    scene: null,
    camera: null,
    renderer: null,
    typeRanges: {
        int16: [-32768, 32767]
    },

    init(canvas, parent) {

        const startWidth = Number(window.getComputedStyle(parent).width.split('px')[0]);
        const startHeight = Number(window.getComputedStyle(parent).height.split('px')[0]);

        const scene = new THREE.Scene(); 
        const camera = new THREE.OrthographicCamera(0, startWidth, 0, startHeight, -1, 1); //left, right, top , bottom, near, far

        const renderer = new THREE.WebGLRenderer( { canvas: canvas, alpha: true, antialias: true } );
        renderer.setSize(startWidth, startHeight);

        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
    },

    zoom(scale){

        this.camera.zoom += scale;
        this.camera.updateProjectionMatrix();
        this.renderer.render(this.scene, this.camera);

        console.log('[ZOOMING]')


    },

    updateGroup(group, translateX, translateY, width, height, lineData){



    },


    createGroup(translateX, translateY, width, height, lineData){

        const parent = new THREE.Group();
        parent.position.set(translateX + (width * 0.5), translateY + (height * 0.5), 0);

        lineData.points.map((pt) => {
            pt[0] = scaler(pt[0], 0, lineData.points.length, width * -0.5, width * 0.5)
            pt[1] = scaler(pt[1], this.typeRanges.int16[0], this.typeRanges.int16[1], height * -0.5, height * 0.5)
            return pt
        })

        const line = new MeshLine()
        line.setPoints(lineData.points.flat())

        const mat = new MeshLineMaterial({
            color: new THREE.Color(0xfafafa),
            opacity: 0.8,
            lineWidth: 1,
            transparent: true
        });

        const mesh = new THREE.Mesh(line, mat);
        
        parent.add(mesh);
        this.scene.add(parent)

        this.renderer.render(this.scene, this.camera);

        return parent

    },


    animate(){

        requestAnimationFrame(this.animate.bind(this));
        this.renderer.render(this.scene, this.camera);

    }


}