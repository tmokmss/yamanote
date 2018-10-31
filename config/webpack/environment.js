const { environment } = require('@rails/webpacker')
const customConfig = require('./custom')

const vue =  require('./loaders/vue')

// Merge custom config
environment.config.merge(customConfig)

environment.loaders.append('vue', vue)
module.exports = environment
