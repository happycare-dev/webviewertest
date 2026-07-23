const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadLoginPage(account, password) {
  let submitHandler;
  const calls = [];

  function element(value) {
    return {
      value: value || '',
      textContent: '',
      hidden: false,
      disabled: false,
      focused: false,
      classList: { add() {}, remove() {} },
      addEventListener(event, handler) {
        if (event === 'submit') submitHandler = handler;
      },
      focus() {
        this.focused = true;
      }
    };
  }

  const elements = {
    account: element(account),
    password: element(password),
    loginFeedback: element(),
    loginForm: element(),
    btnSubmit: element()
  };

  const context = {
    alert() {},
    clearTimeout() {},
    console,
    FileMaker: {
      PerformScript(name, payload) {
        calls.push({ name, payload });
      }
    },
    document: {
      addEventListener(event, handler) {
        if (event === 'DOMContentLoaded') handler();
      },
      getElementById(id) {
        return elements[id] || null;
      }
    },
    setTimeout() {
      return 1;
    },
    window: {}
  };

  const source = fs.readFileSync(path.join(root, 'login.js'), 'utf8');
  vm.runInNewContext(source, context, { filename: 'login.js' });
  submitHandler({ preventDefault() {} });

  return { calls, elements };
}

test('the login page rejects an empty password before calling FileMaker', () => {
  const { calls, elements } = loadLoginPage('active-user', '');

  assert.deepEqual(calls, []);
  assert.equal(elements.loginFeedback.textContent, 'パスワードを入力してください。');
  assert.equal(elements.password.focused, true);
});

test('LoginValidate rejects an empty password before querying EmployeeM', () => {
  const script = fs.readFileSync(
    path.join(root, ' FileMakerScripts', 'LoginValidate.txt'),
    'utf8'
  );
  const guard = script.indexOf('If [ IsEmpty ( $password ) ]');
  const query = script.indexOf('Execute FileMaker Data API');

  assert.notEqual(guard, -1, 'missing server-side empty-password guard');
  assert.ok(guard < query, 'empty-password guard must run before EmployeeM lookup');
  assert.match(
    script.slice(guard, query),
    /Exit Script \[ Text Result: False \]/,
    'empty-password guard must terminate the login attempt'
  );
});
