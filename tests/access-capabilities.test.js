const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function makeElement(id) {
  return {
    id,
    hidden: false,
    innerHTML: '',
    textContent: '',
    value: '',
    disabled: false,
    style: {},
    children: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    getAttribute(name) {
      return this[name];
    },
    querySelector() {
      return null;
    }
  };
}

function loadViewer() {
  const elements = {
    tbody: makeElement('tbody'),
    empty: makeElement('empty'),
    count: makeElement('count'),
    total: makeElement('total'),
    pageInfo: makeElement('pageInfo'),
    btnPrev: makeElement('btnPrev'),
    btnNext: makeElement('btnNext'),
    secAccount: makeElement('secAccount'),
    secPrivilegeSet: makeElement('secPrivilegeSet'),
    secLayoutAccess: makeElement('secLayoutAccess'),
    secRecordAccess: makeElement('secRecordAccess'),
    secActionsList: makeElement('secActionsList'),
    secActionsEmpty: makeElement('secActionsEmpty'),
    securityModal: makeElement('securityModal')
  };
  const actionHeader = makeElement('actionsHeader');

  const document = {
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(selector) {
      return selector === 'th.col-actions' ? actionHeader : null;
    },
    querySelectorAll() {
      return [];
    },
    createElement(tagName) {
      const el = makeElement(tagName);
      el.tagName = tagName.toUpperCase();
      return el;
    },
    createTextNode(text) {
      return { nodeType: 3, textContent: String(text) };
    }
  };

  const context = {
    console,
    document,
    requestAnimationFrame(callback) {
      callback();
    },
    alert() {},
    window: {}
  };
  context.window = context;
  vm.createContext(context);

  ['employee-viewer-core.js', 'employee-viewer-utils-dom.js', 'employee-viewer-table.js', 'employee-viewer-data.js']
    .forEach((file) => {
      vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    });

  return { context, elements, actionHeader };
}

function seedRows(context) {
  context.EV.state.filtered = [{
    apiRecordId: '101',
    recordId: '101',
    fullName: '山田 太郎',
    location: '東京',
    status: '在籍',
    joinDate: '2024/01/01',
    leaveDate: ''
  }];
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('GetUiCapabilities derives edit/delete from FileMaker access codes', () => {
  const script = fs.readFileSync(path.join(root, ' FileMakerScripts', 'GetUiCapabilities.txt'), 'utf8');

  assert.match(script, /Get\s*\(\s*RecordAccess\s*\)/);
  assert.match(script, /Get\s*\(\s*LayoutAccess\s*\)/);
  assert.doesNotMatch(script, /AccountPrivilegeSetName/);
});

test('editable record and modifiable layout access enable edit/delete UI for custom roles', () => {
  const { context, elements, actionHeader } = loadViewer();
  seedRows(context);

  context.receiveUiCapabilities(JSON.stringify({ recordAccess: 2, layoutAccess: 2 }));

  assert.equal(context.EV.state.canEditDelete, true);
  assert.equal(actionHeader.style.display, '');
  assert.match(elements.tbody.innerHTML, /class="btn-edit"/);
  assert.match(elements.tbody.innerHTML, /class="btn-delete"/);
});

test('view-only record access keeps edit/delete UI hidden', () => {
  const { context, elements, actionHeader } = loadViewer();
  seedRows(context);

  context.receiveUiCapabilities(JSON.stringify({ recordAccess: 1, layoutAccess: 2 }));

  assert.equal(context.EV.state.canEditDelete, false);
  assert.equal(actionHeader.style.display, 'none');
  assert.doesNotMatch(elements.tbody.innerHTML, /class="btn-edit"/);
  assert.doesNotMatch(elements.tbody.innerHTML, /class="btn-delete"/);
});

test('security modal labels FileMaker access codes accurately', () => {
  const { context, elements } = loadViewer();

  context.receiveSecurityInfo(JSON.stringify({
    accountName: 'custom-editor',
    privilegeSetName: 'Custom Editor',
    extendedPrivilegesRaw: '',
    recordAccess: 2,
    layoutAccess: 2
  }));

  assert.match(elements.secRecordAccess.textContent, /編集/);
  assert.match(elements.secLayoutAccess.textContent, /変更|編集|修正|modifiable/i);
});
