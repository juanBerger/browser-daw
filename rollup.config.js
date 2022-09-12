import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import css from 'rollup-plugin-css-only'
import del from 'rollup-plugin-delete'
import copy from 'rollup-plugin-copy';
import OMT from "@surma/rollup-plugin-off-main-thread";


//Add any files here not part of the build graph
const externalWatchFiles = [
  'src/awp.js',
  'public/index.html'
]

export default {
    input: 'src/app.js',
    output: {
      dir: 'public',
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
      
        del({ targets: ['public/*', '!public/test_1.wav', '!public/index.html', '!public/styles.css']}),

        copy({
          targets: [
            {src: ['src/awp.js', 'src/audio-utils.js', 'src/utils.js'], dest: 'public'},
          ]
        }),
        
        svelte({include: 'src/*.svelte'}),
        resolve({browser: true}),
        commonjs(),
        css({output: 'styles.css'}),
        OMT()
    ]
  };
  