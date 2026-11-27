import axios from 'axios';
import demoAdapter from './demoAdapter';

const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8082/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});
// Demonstration build only (docs/deploy-producao.md): the flag is replaced at build time, so the branch is dead code elsewhere.
if (process.env.REACT_APP_DEMO === '1') {
  instance.defaults.adapter = demoAdapter;
}

export default instance;
