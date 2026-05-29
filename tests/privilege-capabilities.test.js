const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');

function readRepoFile() {
  return fs.readFileSync(path.join(repoRoot, ...arguments), 'utf8');
}

function runTest(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (error) {
    console.error('not ok - ' + name);
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  }
}

runTest('GetUiCapabilities derives edit/delete permission from access codes', function () {
  const script = readRepoFile(' FileMakerScripts', 'GetUiCapabilities.txt');

  assert.match(script, /Get\s*\(\s*RecordAccess\s*\)/);
  assert.match(script, /Get\s*\(\s*LayoutAccess\s*\)/);
  assert.match(script, /GetAsNumber\s*\(\s*\$recordAccess\s*\)\s*=\s*2/);
  assert.match(script, /GetAsNumber\s*\(\s*\$layoutAccess\s*\)\s*=\s*2/);
  assert.doesNotMatch(script, /AccountPrivilegeSetName|"\[Full Access\]"|"Admin"|"Manager"/);
});

runTest('receiveSecurityInfo labels access code 2 as editable, not view-only', function () {
  const elements = {};

  function makeElement(id) {
    return {
      id: id,
      hidden: false,
      style: {},
      children: [],
      innerHTML: '',
      textContent: '',
      appendChild: function (child) {
        this.children.push(child);
      }
    };
  }

  [
    'secAccount',
    'secPrivilegeSet',
    'secLayoutAccess',
    'secRecordAccess',
    'secActionsList',
    'secActionsEmpty',
    'securityModal'
  ].forEach(function (id) {
    elements[id] = makeElement(id);
  });

  const context = {
    console: console,
    document: {
      getElementById: function (id) {
        return elements[id] || null;
      },
      createElement: makeElement,
      createTextNode: function (text) {
        return { textContent: String(text) };
      }
    },
    alert: function (message) {
      throw new Error('unexpected alert: ' + message);
    }
  };
  context.window = context;
  context.EV = {
    state: {},
    showModalOverlay: function (overlay) {
      overlay.style.display = 'flex';
    }
  };

  vm.runInNewContext(readRepoFile('employee-viewer-data.js'), context, {
    filename: 'employee-viewer-data.js'
  });

  context.receiveSecurityInfo(JSON.stringify({
    accountName: 'editor',
    privilegeSetName: 'HR Editor',
    extendedPrivilegesRaw: '',
    recordAccess: 2,
    layoutAccess: 2
  }));

  assert.doesNotMatch(elements.secRecordAccess.textContent, /\u8868\u793a\u306e\u307f/);
  assert.match(elements.secRecordAccess.textContent, /\u7de8\u96c6/);
  assert.doesNotMatch(elements.secLayoutAccess.textContent, /\u8868\u793a\u306e\u307f/);
  assert.match(elements.secLayoutAccess.textContent, /\u5909\u66f4|\u4fee\u6b63/);
});
