const { environment } = require('@rails/webpacker')
const customConfig = require('./custom')

const vue =  require('./loaders/vue')

// Merge custom config
environment.config.merge(customConfig)

// Enable css modules with sass loader
const sassLoader = environment.loaders.get('sass')
const cssLoader = sassLoader.use.find(loader => loader.loader === 'css-loader')

cssLoader.options = Object.assign(cssLoader.options, {
  modules: true,
  localIdentName: '[path][name]__[local]--[hash:base64:5]'
})

environment.loaders.append('vue', vue)
module.exports = environment
