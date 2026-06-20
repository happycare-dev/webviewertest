const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scriptsDir = path.join(repoRoot, ' FileMakerScripts');

function readScript(name) {
  return fs.readFileSync(path.join(scriptsDir, name), 'utf8');
}

function assertContains(haystack, needle, message) {
  assert.notStrictEqual(haystack.indexOf(needle), -1, message || `Expected to find ${needle}`);
}

function assertBefore(haystack, first, second, message) {
  const firstIndex = haystack.indexOf(first);
  const secondIndex = haystack.indexOf(second);
  assert.notStrictEqual(firstIndex, -1, `Expected to find ${first}`);
  assert.notStrictEqual(secondIndex, -1, `Expected to find ${second}`);
  assert(
    firstIndex < secondIndex,
    message || `Expected ${first} to appear before ${second}`
  );
}

function assertNotContains(haystack, needle, message) {
  assert.strictEqual(haystack.indexOf(needle), -1, message || `Expected not to find ${needle}`);
}

function run() {
  const loginValidate = readScript('LoginValidate.txt');
  const getData = readScript('GetData.txt');
  const getLocations = readScript('GetLocations.txt');
  const getUiCapabilities = readScript('GetUiCapabilities.txt');
  const getSecurityInfo = readScript('GetSecurityInfo.txt');
  const updateScript = readScript('UpdateEmployeeDataAPI.txt');
  const deleteScript = readScript('DeleteRecord.txt');

  assertContains(loginValidate, '$$wvLoginAccount', 'LoginValidate must manage the trusted login account global');
  assertContains(loginValidate, '$$wvLoginPrivilegeSet', 'LoginValidate must manage the trusted privilege-set global');
  assertContains(loginValidate, '$$wvLoginCanEditDelete', 'LoginValidate must manage the trusted edit/delete global');
  assertBefore(
    loginValidate,
    '$loginSuccess ; Value: 1',
    '$$wvLoginAccount',
    'Trusted login globals must only be set after password validation succeeds'
  );
  assertBefore(
    loginValidate,
    '$$wvLoginAccount',
    'Go to Layout',
    'Trusted login globals must be set before entering the data layout'
  );

  [getData, getLocations].forEach((script) => {
    assertContains(script, '$$wvLoginAccount', 'Read scripts must require a validated employee login');
    assertBefore(
      script,
      '$$wvLoginAccount',
      'Execute FileMaker Data API',
      'Read authorization must run before Data API access'
    );
  });

  assertContains(getData, 'JSONDeleteElement', 'GetData must strip sensitive fields before returning records');
  assertContains(getData, 'fieldData.パスワード', 'GetData must explicitly remove password fields');
  assertBefore(
    getData,
    'JSONDeleteElement',
    'receiveDataFromFileMaker',
    'GetData must strip passwords before invoking the Web Viewer callback'
  );

  assertContains(getUiCapabilities, '$$wvLoginCanEditDelete', 'UI capabilities must come from the validated login');
  assertNotContains(
    getUiCapabilities,
    'Get ( AccountPrivilegeSetName )',
    'UI capabilities must not trust the FileMaker host account privilege set'
  );

  [updateScript, deleteScript].forEach((script) => {
    assertContains(script, '$$wvLoginCanEditDelete', 'Mutation scripts must enforce edit/delete capability server-side');
    assertBefore(
      script,
      '$$wvLoginCanEditDelete',
      'Execute FileMaker Data API',
      'Mutation authorization must run before Data API writes'
    );
  });

  assertContains(getSecurityInfo, '$$wvLoginAccount', 'Security modal must display the validated login account');
  assertContains(getSecurityInfo, '$$wvLoginPrivilegeSet', 'Security modal must display the validated privilege set');
  assertNotContains(
    getSecurityInfo,
    'Get ( AccountPrivilegeSetName )',
    'Security modal must not report the FileMaker host account privilege set as the employee login'
  );
}

run();
console.log('security-contract tests passed');
