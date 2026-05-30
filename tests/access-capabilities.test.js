const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadViewerData() {
  const sandbox = {
    console,
    alert(message) {
      throw new Error('Unexpected alert: ' + message);
    }
  };
  sandbox.window = sandbox;
  sandbox.document = {
    getElementById() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  vm.createContext(sandbox);

  ['employee-viewer-core.js', 'employee-viewer-data.js'].forEach((file) => {
    vm.runInContext(
      fs.readFileSync(path.join(root, file), 'utf8'),
      sandbox,
      { filename: file }
    );
  });

  return sandbox;
}

function makeElement() {
  return {
    children: [],
    hidden: false,
    innerHTML: '',
    style: {},
    textContent: '',
    appendChild(child) {
      this.children.push(child);
      this.textContent += child.textContent || '';
    }
  };
}

function installSecurityModalDom(sandbox) {
  const elements = {
    secAccount: makeElement(),
    secPrivilegeSet: makeElement(),
    secLayoutAccess: makeElement(),
    secRecordAccess: makeElement(),
    secActionsList: makeElement(),
    secActionsEmpty: makeElement(),
    securityModal: makeElement()
  };

  sandbox.document = {
    getElementById(id) {
      return elements[id] || null;
    },
    createElement() {
      return makeElement();
    },
    createTextNode(text) {
      const el = makeElement();
      el.textContent = String(text);
      return el;
    }
  };
  sandbox.EV.showModalOverlay = function (overlay) {
    overlay.style.display = 'flex';
  };

  return elements;
}

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (error) {
    console.error('not ok - ' + name);
    throw error;
  }
}

test('receiveUiCapabilities grants editing for FileMaker record/layout access code 2', () => {
  const sandbox = loadViewerData();
  let renderCalls = 0;
  sandbox.EV.render = function () {
    renderCalls += 1;
  };

  sandbox.receiveUiCapabilities(JSON.stringify({
    recordAccess: 2,
    layoutAccess: 2
  }));

  assert.equal(sandbox.EV.state.canEditDelete, true);
  assert.equal(renderCalls, 1);
});

test('receiveUiCapabilities denies editing when either FileMaker access layer is view-only', () => {
  const sandbox = loadViewerData();

  sandbox.receiveUiCapabilities(JSON.stringify({
    recordAccess: 2,
    layoutAccess: 1
  }));

  assert.equal(sandbox.EV.state.canEditDelete, false);
});

test('security modal labels FileMaker access code 2 as editable/modifiable', () => {
  const sandbox = loadViewerData();
  const elements = installSecurityModalDom(sandbox);

  sandbox.receiveSecurityInfo(JSON.stringify({
    accountName: 'hr@example.com',
    privilegeSetName: 'HR Editor',
    extendedPrivilegesRaw: '',
    recordAccess: 2,
    layoutAccess: 2
  }));

  assert.match(elements.secRecordAccess.textContent, /編集が可能/);
  assert.match(elements.secLayoutAccess.textContent, /変更が可能/);
});
