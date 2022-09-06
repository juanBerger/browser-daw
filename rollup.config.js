import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import css from 'rollup-plugin-css-only'
import copy from 'rollup-plugin-copy';

//Add any files here not part of the build graph
const externalWatchFiles = [
  'src/awp.js',
  'public/index.html'
]

export default {
    input: 'src/app.js',
    output: {
      file: 'public/app.js',
      sourcemap: true,
      format: 'esm'
    },

    plugins: [
        
        {
          name: 'add-watch',
          buildStart(){
            externalWatchFiles.forEach(filePath => this.addWatchFile(filePath))
          }
        },
      
        copy({
          targets: [
            {src: ['src/awp.js', 'src/audio-utils.js', 'src/utils.js', 'src/three.js', 'src/jquery-3.6.1.min'], dest: 'public'},
          ]
        }),
        
        svelte({include: 'src/*.svelte'}),
        resolve({browser: true}),
        commonjs(),
        css({output: 'styles.css'}),
    ]
  };
  