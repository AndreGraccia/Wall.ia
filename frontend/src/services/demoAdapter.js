import data from './demo-data.json';

/**
 * Demonstration mode (REACT_APP_DEMO=1): the site answers from recorded data of a fictional account, so it can be
 * shown without the API. Nothing leaves the browser and nothing is saved; writes answer success and change nothing.
 * Never built into the real site: the flag is replaced at build time and the import below is dropped otherwise.
 */
const day = (seconds) => Math.floor(Date.now() / 1000) + seconds;
const b64 = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fakeToken = () => `${b64({ alg: 'none' })}.${b64({ sub: 'demo', exp: day(60 * 60 * 24) })}.demo`;

const reply = (config, status, body) =>
  Promise.resolve({ data: body, status, statusText: String(status), headers: {}, config, request: {} });

const stripBase = (url) => url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api\/v1/, '');

function lookup(config) {
  const raw = stripBase(config.url || '');
  const params = config.params ? `?${new URLSearchParams(config.params)}` : '';
  const exact = data.gets[raw + params];
  if (exact !== undefined) return exact;
  const [path] = raw.split('?');
  // Same path with another query (another month, horizon or page): the nearest recorded answer.
  const key = Object.keys(data.gets).find((item) => item.split('?')[0] === path);
  return key === undefined ? undefined : data.gets[key];
}

export default function demoAdapter(config) {
  const method = (config.method || 'get').toLowerCase();
  const path = stripBase(config.url || '').split('?')[0];
  if (method === 'post' && path === '/auth/login') {
    return reply(config, 200, { ...data.login, token: fakeToken(), type: 'Bearer' });
  }
  if (method === 'post' && path === '/future/ask') {
    const asked = JSON.parse(config.data || '{}').question || '';
    return reply(config, 200, data.asks[asked] || data.asks['Qual ação devo comprar na bolsa?']);
  }
  if (method === 'get') {
    const found = lookup(config);
    return found === undefined ? reply(config, 404, null) : reply(config, 200, found);
  }
  return reply(config, 200, {});
}
