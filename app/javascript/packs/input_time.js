// import 'vuetify/dist/vuetify.min.css' // Ensure you are using css-loader
// import 'material-design-icons-iconfont/dist/material-design-icons.css'

import Vue from 'vue/dist/vue.esm'
import App from '../timeDialogAndMenu.vue'
import Vuetify from 'vuetify'

Vue.use(Vuetify)

document.addEventListener('DOMContentLoaded', () => {
  const app = new Vue({
    el: '#hello',
    data: {
      message: "Can you say hello?"
    },
    components: {App}
  })
})