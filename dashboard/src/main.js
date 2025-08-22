// Import bootstrap css
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue-next/dist/bootstrap-vue-next.css';
import 'startbootstrap-sb-admin-2/css/sb-admin-2.css';

import { createApp } from 'vue';
import BootstrapVueNext from 'bootstrap-vue-next';
import App from './App.vue';
import router from './router';
import store from './store';

const app = createApp(App);

app.use(BootstrapVueNext);
app.use(router);
app.use(store);

app.mount('#app');
