const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');

function loadScript(context, fileName) {
  vm.runInContext(
    fs.readFileSync(path.join(repoRoot, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
}

function createViewerContext() {
  const context = {
    console,
    window: null,
    renderCount: 0
  };
  context.window = context;
  vm.createContext(context);
  loadScript(context, 'employee-viewer-core.js');
  context.window.EV.render = function () {
    context.renderCount += 1;
  };
  loadScript(context, 'employee-viewer-data.js');
  return context;
}

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    console.error('not ok - ' + name);
    throw err;
  }
}

test('allows edit/delete for accounts with FileMaker record and layout edit access', function () {
  const context = createViewerContext();

  context.window.receiveUiCapabilities(JSON.stringify({
    privilegeSetName: 'HR Editors',
    canEditDelete: false,
    recordAccess: 2,
    layoutAccess: 2
  }));

  assert.equal(context.window.EV.state.canEditDelete, true);
  assert.equal(context.renderCount, 1);
});

test('keeps edit/delete disabled for view-only record access', function () {
  const context = createViewerContext();

  context.window.receiveUiCapabilities(JSON.stringify({
    privilegeSetName: 'Read Only',
    canEditDelete: false,
    recordAccess: 1,
    layoutAccess: 2
  }));

  assert.equal(context.window.EV.state.canEditDelete, false);
  assert.equal(context.renderCount, 1);
});

test('still honors an explicit positive capability flag', function () {
  const context = createViewerContext();

  context.window.receiveUiCapabilities(JSON.stringify({
    canEditDelete: true
  }));

  assert.equal(context.window.EV.state.canEditDelete, true);
  assert.equal(context.renderCount, 1);
});
