// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import copy from 'rollup-plugin-copy'

export default {
  input: 'record/javascripts/main.mjs',
  output: {
    file: 'dist/javascripts/main.mjs',
    format: 'esm'
  },
  plugins: [ 
    copy({
      targets: ['record/index.html', 'record/images', 'record/styles','record/javascripts'],
      outputFolder: 'dist'
    }),
    commonjs({
      // non-CommonJS modules will be ignored, but you can also
      // specifically include/exclude files
      include: 'node_modules/**'
    }),
    resolve({
      browser: true,
    })  
  ]
};