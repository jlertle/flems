const wright = require('wright')
    , rollup = require('rollup')
    , commonjs = require('rollup-plugin-commonjs')
    , nodeResolve = require('rollup-plugin-node-resolve')
    , replace = require('rollup-plugin-replace')
    , string = require('rollup-plugin-string')
    , buble = require('rollup-plugin-buble')
    , codemirrorCss = require('./codemirrorcss')

wright({
  main: 'scripts/wright.html',
  serve: 'dist',
  // run: 'm.redraw',
  debug: true,
  js: {
    watch: 'src/**/*.js',
    path: 'flems.js',
    compile: roll
  }
})

let cache = null
function roll(dev) {
  return rollup.rollup({
    input: 'src/index.js',
    cache: cache,
    plugins: [
      replace({ codemirrorStyles: JSON.stringify(codemirrorCss) }),
      string({ include: 'src/**/*.svg' }),
      commonjs(),
      nodeResolve(),
      buble()
    ]
  })
  .then(bundle => {
    cache = bundle
    return bundle.generate({
      name: 'Flems',
      format: 'umd'
    })
  })
  .then(result => result.code)
}