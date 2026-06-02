const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadViewerData() {
  const context = {
    console,
    window: {
      EV: {
        state: { canEditDelete: false },
        DEFAULT_LIMIT: 50,
        FIELD_MAP: {},
        clearRowHighlight: function () {},
        render: function () {
          this.renderCount = (this.renderCount || 0) + 1;
        }
      }
    }
  };
  context.global = context.window;

  const source = fs.readFileSync(path.join(__dirname, '..', 'employee-viewer-data.js'), 'utf8');
  vm.runInNewContext(source, context, { filename: 'employee-viewer-data.js' });
  return context.window;
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

test('allows edit controls when FileMaker record and layout access are modifiable', function () {
  const window = loadViewerData();

  window.receiveUiCapabilities(JSON.stringify({
    canEditDelete: false,
    recordAccess: 2,
    layoutAccess: 2
  }));

  assert.strictEqual(window.EV.state.canEditDelete, true);
});

test('does not allow edit controls when FileMaker access is view only', function () {
  const window = loadViewerData();

  window.receiveUiCapabilities(JSON.stringify({
    canEditDelete: true,
    recordAccess: 1,
    layoutAccess: 1
  }));

  assert.strictEqual(window.EV.state.canEditDelete, false);
});
