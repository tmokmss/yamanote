// config/webpack/custom.js

const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
  resolve: {
    alias: {
      vue$: 'vue/dist/vue.esm.js'
    }
  },
  // module: {
  //   rules: [
  //     {
  //       test: /\.css$/,
  //       use: [ 'style-loader', 'css-loader' ]
  //     }
  //   ]
  // }
}
