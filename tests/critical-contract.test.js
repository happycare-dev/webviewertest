const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const scriptDir = path.join(root, ' FileMakerScripts');
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readScript(name) {
  return fs.readFileSync(path.join(scriptDir, name), 'utf8');
}

function executableScript(name) {
  return readScript(name)
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//');
    })
    .join('\n');
}

function assertContains(text, needle, message) {
  assert.notEqual(text.indexOf(needle), -1, message || `Expected to find ${needle}`);
}

function assertNotContains(text, needle, message) {
  assert.equal(text.indexOf(needle), -1, message || `Expected not to find ${needle}`);
}

function assertBefore(text, earlier, later, message) {
  const earlierIndex = text.indexOf(earlier);
  const laterIndex = text.indexOf(later);
  assert.notEqual(earlierIndex, -1, `Missing earlier text: ${earlier}`);
  assert.notEqual(laterIndex, -1, `Missing later text: ${later}`);
  assert(
    earlierIndex < laterIndex,
    message || `Expected ${earlier} to appear before ${later}`,
  );
}

test('LoginValidate resets stale trusted globals before lookup and sets them only after password validation succeeds', () => {
  const script = executableScript('LoginValidate.txt');
  assertBefore(script, 'Set Variable [ $$wvLoginAccount ; Value: "" ]', 'Execute FileMaker Data API');
  assertBefore(script, 'Set Variable [ $$wvLoginPrivilegeSet ; Value: "" ]', 'Execute FileMaker Data API');
  assertBefore(script, 'Set Variable [ $$wvLoginCanEditDelete ; Value: False ]', 'Execute FileMaker Data API');

  const successIndex = script.indexOf('Set Variable [ $loginSuccess ; Value: 1 ]');
  assert.notEqual(successIndex, -1, 'LoginValidate must have an explicit success point');
  const accountIndex = script.indexOf('Set Variable [ $$wvLoginAccount ; Value:');
  const privilegeIndex = script.indexOf('Set Variable [ $$wvLoginPrivilegeSet ; Value:');
  const canEditIndex = script.indexOf('Set Variable [ $$wvLoginCanEditDelete ; Value:');
  assert(accountIndex > successIndex, 'trusted account must be set only after validation succeeds');
  assert(privilegeIndex > successIndex, 'trusted privilege set must be set only after validation succeeds');
  assert(canEditIndex > successIndex, 'edit/delete capability must be set only after validation succeeds');
  assertContains(script, 'fieldData.アカウント', 'trusted account should come from the validated EmployeeM record');
  assertContains(script, 'fieldData.アクセス権セット', 'trusted privilege set should come from the validated EmployeeM record');
});

test('read-only data scripts require a validated Web Viewer login before returning employee data', () => {
  const getData = executableScript('GetData.txt');
  assertBefore(getData, 'If [ IsEmpty ( $$wvLoginAccount ) ]', 'Execute FileMaker Data API');
  assertBefore(getData, 'If [ IsEmpty ( $$wvLoginAccount ) ]', 'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "receiveDataFromFileMaker"');
  assertContains(getData, 'JSONDeleteElement ( $result ; "response.data[" & $i & "].fieldData.パスワード" )');

  const getLocations = executableScript('GetLocations.txt');
  assertBefore(getLocations, 'If [ IsEmpty ( $$wvLoginAccount ) ]', 'ExecuteSQL');
  assertBefore(getLocations, 'If [ IsEmpty ( $$wvLoginAccount ) ]', 'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "receiveLocations"');
});

test('mutation scripts enforce edit/delete authorization before Data API writes', () => {
  for (const name of ['UpdateEmployeeDataAPI.txt', 'DeleteRecord.txt']) {
    const script = executableScript(name);
    assertBefore(script, 'If [ $$wvLoginCanEditDelete ≠ True ]', 'Execute FileMaker Data API', `${name} must authorize before Data API mutation`);
    assertBefore(script, 'If [ $$wvLoginCanEditDelete ≠ True ]', 'Set Variable [ $request ; Value: JSONSetElement ( "{}" ; [ "action"', `${name} must authorize before building a mutation request`);
  }
});

test('capability and security callbacks report trusted login-derived state instead of the FileMaker file account', () => {
  const caps = executableScript('GetUiCapabilities.txt');
  assertContains(caps, '$$wvLoginCanEditDelete');
  assertNotContains(caps, 'Get ( AccountPrivilegeSetName )', 'UI capabilities must not trust the FileMaker file account');

  const info = executableScript('GetSecurityInfo.txt');
  assertContains(info, '$$wvLoginAccount');
  assertContains(info, '$$wvLoginPrivilegeSet');
  assertContains(info, '$$wvLoginCanEditDelete');
});

test('GetData echoes request identifiers so stale Web Viewer callbacks can be discarded', () => {
  const script = executableScript('GetData.txt');
  assertContains(script, 'Set Variable [ $requestId ; Value: JSONGetElement ( $json ; "requestId" ) ]');
  assertBefore(script, 'Set Variable [ $result ; Value: JSONSetElement ( $result ; [ "webViewerRequestId" ; $requestId ; JSONString ] ) ]', 'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "receiveDataFromFileMaker"');
});

function makeElement() {
  return {
    textContent: '',
    disabled: false,
    style: {},
    innerHTML: '',
    value: '',
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    appendChild() {},
    setAttribute() {},
    getAttribute() {
      return '';
    },
    classList: {
      add() {},
      remove() {},
    },
  };
}

function createViewerSandbox() {
  const elements = new Map();
  const calls = [];
  const sandbox = {
    console,
    setTimeout(fn) {
      fn();
    },
    requestAnimationFrame(fn) {
      fn();
    },
    FileMaker: {
      PerformScript(name, param) {
        calls.push({ name, param });
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return makeElement();
    },
    createElement() {
      return makeElement();
    },
    createTextNode(text) {
      return { textContent: text };
    },
  };

  for (const file of [
    'employee-viewer-core.js',
    'employee-viewer-utils-dom.js',
    'employee-viewer-table.js',
    'employee-viewer-data.js',
  ]) {
    vm.runInNewContext(readText(file), sandbox, { filename: file });
  }

  return { sandbox, calls };
}

function dataPayload(requestId, name, recordId) {
  return JSON.stringify({
    webViewerRequestId: requestId,
    messages: [{ code: '0' }],
    response: {
      dataInfo: { foundCount: 100 },
      data: [{
        recordId,
        modId: '1',
        fieldData: {
          氏名: name,
          事業所略称: 'HQ',
          在籍フラグ: '1',
          '入社　年月日': '1/2/2020',
          '退職　年月日': '',
        },
      }],
    },
  });
}

test('Web Viewer ignores older GetData callbacks after a newer request is issued', () => {
  const { sandbox, calls } = createViewerSandbox();
  const EV = sandbox.window.EV;

  EV.runFileMakerScript(0, EV.DEFAULT_LIMIT);
  EV.runFileMakerScript(EV.DEFAULT_LIMIT, EV.DEFAULT_LIMIT);
  assert.equal(calls.length, 2, 'expected two FileMaker GetData calls');

  const firstRequest = JSON.parse(calls[0].param);
  const secondRequest = JSON.parse(calls[1].param);
  assert.ok(firstRequest.requestId, 'first GetData call should include a requestId');
  assert.ok(secondRequest.requestId, 'second GetData call should include a requestId');
  assert.notEqual(firstRequest.requestId, secondRequest.requestId, 'requestIds must be unique');

  sandbox.window.receiveDataFromFileMaker(dataPayload(firstRequest.requestId, 'Old Page', 'old-record'));
  assert.deepEqual(EV.state.rows, [], 'stale first response must not replace current rows');

  sandbox.window.receiveDataFromFileMaker(dataPayload(secondRequest.requestId, 'Current Page', 'current-record'));
  assert.equal(EV.state.rows.length, 1);
  assert.equal(EV.state.rows[0].fullName, 'Current Page');
  assert.equal(EV.state.rows[0].apiRecordId, 'current-record');
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

if (failures > 0) {
  console.error(`${failures} test(s) failed`);
  process.exitCode = 1;
} else {
  console.log(`${tests.length} test(s) passed`);
}
