const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const scriptsDir = path.join(root, ' FileMakerScripts');

function readScript(name) {
  return fs.readFileSync(path.join(scriptsDir, name), 'utf8');
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

test('LoginValidate rejects blank passwords before authenticating', () => {
  const script = readScript('LoginValidate.txt');

  assert.match(script, /IsEmpty\s*\(\s*\$password\s*\)/);
  assert.match(script, /\$errorCode\s*;\s*Value:\s*"wrong_password"/);
});

test('LoginValidate establishes FileMaker and Web Viewer session on success', () => {
  const script = readScript('LoginValidate.txt');

  assert.match(script, /Re-Login\s*\[/);
  assert.match(script, /\$\$WebViewerEmployeeLoggedIn\s*;\s*Value:\s*1/);
  assert.match(script, /\$\$WebViewerEmployeeAccount\s*;\s*Value:\s*\$account/);
});

test('data and mutation scripts require an authenticated Web Viewer session', () => {
  ['GetData.txt', 'GetLocations.txt', 'UpdateEmployeeDataAPI.txt', 'DeleteRecord.txt'].forEach((name) => {
    const script = readScript(name);

    assert.match(script, /\$\$WebViewerEmployeeLoggedIn\s*=/, name);
    assert.match(script, /login_required/, name);
    assert.match(script, /Exit Script\s*\[\s*Text Result:\s*False\s*\]/, name);
  });
});

test('GetUiCapabilities is session-gated and uses FileMaker access codes', () => {
  const script = readScript('GetUiCapabilities.txt');

  assert.match(script, /\$\$WebViewerEmployeeLoggedIn\s*=/);
  assert.match(script, /Get\s*\(\s*RecordAccess\s*\)/);
  assert.match(script, /Get\s*\(\s*LayoutAccess\s*\)/);
  assert.doesNotMatch(script, /AccountPrivilegeSetName/);
});

test('GetSecurityInfo does not expose FileMaker account details before login', () => {
  const script = readScript('GetSecurityInfo.txt');

  assert.match(script, /\$\$WebViewerEmployeeLoggedIn\s*=/);
  assert.match(script, /login_required/);
  assert.match(script, /Exit Script\s*\[\s*Text Result:\s*False\s*\]/);
});

test('security modal labels current FileMaker 0/1/2 access codes', () => {
  const js = fs.readFileSync(path.join(root, 'employee-viewer-data.js'), 'utf8');

  assert.match(js, /0:\s*'アクセスなし/);
  assert.match(js, /1:\s*'表示のみ/);
  assert.match(js, /2:\s*'編集/);
  assert.doesNotMatch(js, /4:\s*'レコードの編集が可能/);
});
