import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import LifeGoals from './LifeGoals';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({
  getWithAuth: jest.fn(),
  postWithAuth: jest.fn(),
  putWithAuth: jest.fn(),
  deleteWithAuth: jest.fn(),
}));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options?.date ? `${key}:${options.date}` : key),
    i18n: { language: 'pt' },
  }),
}));

const ITEM = {
  id: 4,
  title: 'Mudar de área',
  currentSituation: 'Atendo no balcão',
  desiredSituation: 'Trabalhar com tecnologia',
  targetDate: '2027-12-01',
  estimatedCost: null,
  goal: { id: 3, name: 'Curso', monthlyAmount: 100 },
  steps: [{ id: 9, description: 'Escolher o curso', done: false, doneOn: null }],
};

let root;
let container;
const text = () => container.textContent;
const button = (label, scope = document) =>
  [...scope.querySelectorAll('button')].find((item) => item.textContent === label);
const field = (name) => container.querySelector(`[name="${name}"]`);

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  jest.clearAllMocks();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function answer(items) {
  HttpService.getWithAuth.mockImplementation((url) =>
    url === '/life-goals' ? Promise.resolve({ items }) : Promise.reject(new Error('goals are down'))
  );
}

async function render() {
  await act(async () =>
    root.render(
      <HelmetProvider>
        <ThemeProvider>
          <LifeGoals />
        </ThemeProvider>
      </HelmetProvider>
    )
  );
}

function type(element, value) {
  const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(prototype.prototype, 'value').set.call(element, value);
  Simulate.change(element);
}

test('the first goal is written with its steps; the three texts are required', async () => {
  answer([]);
  HttpService.postWithAuth.mockResolvedValue({ items: [ITEM] });
  await render();
  expect(text()).toContain('lifeGoals.empty');

  await act(async () => type(field('title'), 'Mudar de área'));
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(HttpService.postWithAuth).not.toHaveBeenCalled();
  expect(text()).toContain('lifeGoals.form.required');

  await act(async () => type(field('currentSituation'), 'Atendo no balcão'));
  await act(async () => type(field('desiredSituation'), 'Trabalhar com tecnologia'));
  await act(async () => Simulate.click(button('lifeGoals.form.addStep')));
  await act(async () => type(field('step'), ' Escolher o curso '));
  await act(async () => Simulate.submit(container.querySelector('form')));

  expect(HttpService.postWithAuth).toHaveBeenCalledWith('/life-goals', {
    title: 'Mudar de área',
    currentSituation: 'Atendo no balcão',
    desiredSituation: 'Trabalhar com tecnologia',
    targetDate: null,
    estimatedCost: null,
    goalId: null,
    steps: [{ id: null, description: 'Escolher o curso', done: false }],
  });
  expect(text()).toContain('lifeGoals.until:01/12/2027');
});

test('a step is marked, with no score on screen, and editing keeps the linked goal', async () => {
  answer([ITEM]);
  HttpService.putWithAuth.mockResolvedValue({
    items: [{ ...ITEM, steps: [{ ...ITEM.steps[0], done: true, doneOn: '2026-11-27' }] }],
  });
  await render();
  expect(text()).not.toMatch(/%/);

  await act(async () =>
    Simulate.change(container.querySelector('input[type="checkbox"]'), { target: { checked: true } })
  );
  expect(HttpService.putWithAuth).toHaveBeenCalledWith('/life-goals/4/steps/9', { done: true });
  expect(text()).toContain('lifeGoals.doneOn:27/11/2026');

  await act(async () => Simulate.click(button('lifeGoals.edit')));
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(HttpService.putWithAuth).toHaveBeenLastCalledWith(
    '/life-goals/4',
    expect.objectContaining({ goalId: 3, steps: [{ id: 9, description: 'Escolher o curso', done: true }] })
  );
});

test('deleting asks first', async () => {
  answer([ITEM]);
  HttpService.deleteWithAuth.mockResolvedValue({ items: [] });
  await render();

  await act(async () => Simulate.click(button('lifeGoals.remove')));
  expect(HttpService.deleteWithAuth).not.toHaveBeenCalled();
  await act(async () => Simulate.click(button('lifeGoals.remove', document.querySelector('[role="dialog"]'))));
  expect(HttpService.deleteWithAuth).toHaveBeenCalledWith('/life-goals/4');
  expect(text()).toContain('lifeGoals.empty');
});

test('a failed load offers to try again', async () => {
  HttpService.getWithAuth.mockRejectedValue({ response: { status: 500 } });
  await render();
  expect(text()).toContain('app.errors.server');

  answer([]);
  await act(async () => Simulate.click(button('app.retry')));
  expect(text()).toContain('lifeGoals.empty');
});
