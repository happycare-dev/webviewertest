const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT_DIR = path.join(ROOT, ' FileMakerScripts');

function readScript(name) {
  return fs.readFileSync(path.join(SCRIPT_DIR, name), 'utf8');
}

function firstIndexOf(script, needle, label) {
  const index = script.indexOf(needle);
  assert.notEqual(index, -1, `${label} should contain ${needle}`);
  return index;
}

function executableDataApiIndex(script, label) {
  const index = script.indexOf('\nExecute FileMaker Data API [ Select');
  assert.notEqual(index, -1, `${label} should execute the FileMaker Data API`);
  return index;
}

test('GetData removes password fields before returning records to the Web Viewer', () => {
  const script = readScript('GetData.txt');
  const dataApiIndex = firstIndexOf(script, 'Execute FileMaker Data API', 'GetData');
  const callbackIndex = firstIndexOf(script, 'receiveDataFromFileMaker', 'GetData');
  const sanitizeIndex = firstIndexOf(script, 'JSONDeleteElement', 'GetData');

  assert(
    dataApiIndex < sanitizeIndex && sanitizeIndex < callbackIndex,
    'GetData should sanitize the Data API result after read and before Perform JavaScript'
  );
  assert.match(
    script.slice(sanitizeIndex, callbackIndex),
    /response\.data\[" & \$i & "\]\.fieldData\.パスワード/,
    'GetData should delete fieldData.パスワード from each returned record'
  );
});

for (const { scriptName, callbackName } of [
  { scriptName: 'DeleteRecord.txt', callbackName: 'receiveDeleteResult' },
  { scriptName: 'UpdateEmployeeDataAPI.txt', callbackName: 'receiveUpdateResult' }
]) {
  test(`${scriptName} rejects unauthorized callers before executing Data API mutations`, () => {
    const script = readScript(scriptName);
    const executeIndex = executableDataApiIndex(script, scriptName);
    const preExecute = script.slice(0, executeIndex);

    assert.match(
      preExecute,
      /Get \( AccountPrivilegeSetName \)/,
      `${scriptName} should check the FileMaker privilege set before mutating records`
    );
    assert.match(preExecute, /\$priv = "\[Full Access\]"/);
    assert.match(preExecute, /\$priv = "Admin"/);
    assert.match(preExecute, /\$priv = "Manager"/);
    assert.match(
      preExecute,
      /If \[ not \$allow \]/,
      `${scriptName} should exit when the caller is not authorized`
    );
    assert.match(
      preExecute,
      new RegExp(`Perform JavaScript in Web Viewer \\[ Object Name: "web" ; Function Name: "${callbackName}"`),
      `${scriptName} should report authorization failures through its existing callback`
    );
  });
}
