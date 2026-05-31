const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');

function readRepoFile() {
  return fs.readFileSync(path.join(repoRoot, ...arguments), 'utf8');
}

function loadViewerData() {
  const context = {
    console,
    alert(message) {
      throw new Error('unexpected alert: ' + message);
    }
  };
  context.window = context;
  context.document = {
    getElementById() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  vm.createContext(context);

  ['employee-viewer-core.js', 'employee-viewer-data.js'].forEach((fileName) => {
    vm.runInContext(readRepoFile(fileName), context, { filename: fileName });
  });

  return context;
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

function installSecurityModalDom(context) {
  const elements = {
    secAccount: makeElement(),
    secPrivilegeSet: makeElement(),
    secLayoutAccess: makeElement(),
    secRecordAccess: makeElement(),
    secActionsList: makeElement(),
    secActionsEmpty: makeElement(),
    securityModal: makeElement()
  };

  context.document = {
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
  context.EV.showModalOverlay = function (overlay) {
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

test('GetUiCapabilities derives edit/delete permission from FileMaker access codes', () => {
  const script = readRepoFile(' FileMakerScripts', 'GetUiCapabilities.txt');

  assert.match(script, /Get\s*\(\s*RecordAccess\s*\)/);
  assert.match(script, /Get\s*\(\s*LayoutAccess\s*\)/);
  assert.match(script, /GetAsNumber\s*\(\s*\$recordAccess\s*\)\s*=\s*2/);
  assert.match(script, /GetAsNumber\s*\(\s*\$layoutAccess\s*\)\s*=\s*2/);
  assert.doesNotMatch(script, /AccountPrivilegeSetName|"\[Full Access\]"|"Admin"|"Manager"/);
});

test('receiveUiCapabilities grants editing for FileMaker record/layout access code 2', () => {
  const context = loadViewerData();
  let renderCalls = 0;
  context.EV.render = function () {
    renderCalls += 1;
  };

  context.receiveUiCapabilities(JSON.stringify({
    recordAccess: 2,
    layoutAccess: 2
  }));

  assert.equal(context.EV.state.canEditDelete, true);
  assert.equal(renderCalls, 1);
});

test('receiveUiCapabilities denies editing when either FileMaker access layer is view-only', () => {
  const context = loadViewerData();

  context.receiveUiCapabilities(JSON.stringify({
    recordAccess: 2,
    layoutAccess: 1
  }));

  assert.equal(context.EV.state.canEditDelete, false);
});

test('security modal labels FileMaker access code 2 as editable/modifiable', () => {
  const context = loadViewerData();
  const elements = installSecurityModalDom(context);

  context.receiveSecurityInfo(JSON.stringify({
    accountName: 'hr@example.com',
    privilegeSetName: 'HR Editor',
    extendedPrivilegesRaw: '',
    recordAccess: 2,
    layoutAccess: 2
  }));

  assert.doesNotMatch(elements.secRecordAccess.textContent, /表示のみ/);
  assert.match(elements.secRecordAccess.textContent, /編集が可能/);
  assert.doesNotMatch(elements.secLayoutAccess.textContent, /表示のみ/);
  assert.match(elements.secLayoutAccess.textContent, /変更が可能/);
});
