const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scriptsDir = fs
  .readdirSync(repoRoot, { withFileTypes: true })
  .find((entry) => entry.isDirectory() && entry.name.trim() === 'FileMakerScripts');

assert(scriptsDir, 'FileMakerScripts directory is missing');

function readScript(name) {
  return fs.readFileSync(path.join(repoRoot, scriptsDir.name, name), 'utf8');
}

function uncommented(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*(#|\/\/)/.test(line))
    .join('\n');
}

function indexOfPattern(text, pattern) {
  const match = text.match(pattern);
  return match ? match.index : -1;
}

function assertContains(text, pattern, message) {
  assert.notStrictEqual(indexOfPattern(text, pattern), -1, message);
}

function assertNotContains(text, pattern, message) {
  assert.strictEqual(indexOfPattern(text, pattern), -1, message);
}

function assertBefore(text, earlier, later, message) {
  const earlierIndex = indexOfPattern(text, earlier);
  const laterIndex = indexOfPattern(text, later);
  assert.notStrictEqual(earlierIndex, -1, `${message}: missing earlier pattern ${earlier}`);
  assert.notStrictEqual(laterIndex, -1, `${message}: missing later pattern ${later}`);
  assert(earlierIndex < laterIndex, message);
}

const loginValidate = uncommented(readScript('LoginValidate.txt'));
const getData = uncommented(readScript('GetData.txt'));
const getLocations = uncommented(readScript('GetLocations.txt'));
const updateScript = uncommented(readScript('UpdateEmployeeDataAPI.txt'));
const deleteScript = uncommented(readScript('DeleteRecord.txt'));
const getUiCapabilities = uncommented(readScript('GetUiCapabilities.txt'));
const getSecurityInfo = uncommented(readScript('GetSecurityInfo.txt'));

assertContains(loginValidate, /\$\$wvLoginAccount/, 'LoginValidate must reset/set trusted login account state');
assertContains(loginValidate, /\$\$wvLoginPrivilegeSet/, 'LoginValidate must reset/set trusted login privilege state');
assertContains(loginValidate, /\$\$wvLoginCanEditDelete/, 'LoginValidate must reset/set trusted edit/delete capability state');
assertContains(loginValidate, /fieldData\.アクセス権セット/, 'LoginValidate must derive privilege from the EmployeeM login record');
assertBefore(
  loginValidate,
  /Set Variable \[ \$\$wvLoginAccount ; Value: "" \]/,
  /Execute FileMaker Data API/,
  'LoginValidate must clear prior trusted login state before validating a new login'
);

assertContains(getData, /\$\$wvLoginAccount/, 'GetData must require a successful Web Viewer login');
assertBefore(
  getData,
  /IsEmpty\s*\(\s*\$\$wvLoginAccount\s*\)/,
  /Execute FileMaker Data API/,
  'GetData must fail closed before reading EmployeeM data'
);
assertBefore(
  getData,
  /JSONDeleteElement[\s\S]*パスワード/,
  /Perform JavaScript in Web Viewer/,
  'GetData must strip employee passwords before returning Data API results to JavaScript'
);

assertContains(getLocations, /\$\$wvLoginAccount/, 'GetLocations must require a successful Web Viewer login');
assertBefore(
  getLocations,
  /IsEmpty\s*\(\s*\$\$wvLoginAccount\s*\)/,
  /ExecuteSQL/,
  'GetLocations must fail closed before reading location data'
);

for (const [name, script] of [
  ['UpdateEmployeeDataAPI', updateScript],
  ['DeleteRecord', deleteScript]
]) {
  assertContains(script, /\$\$wvLoginCanEditDelete/, `${name} must enforce trusted edit/delete capability`);
  assertBefore(
    script,
    /not\s+\$\$wvLoginCanEditDelete/,
    /Execute FileMaker Data API/,
    `${name} must fail closed before mutating EmployeeM records`
  );
}

assertContains(getUiCapabilities, /\$\$wvLoginCanEditDelete/, 'GetUiCapabilities must use login-derived edit/delete capability');
assertNotContains(
  getUiCapabilities,
  /Get\s*\(\s*AccountPrivilegeSetName\s*\)/,
  'GetUiCapabilities must not use the FileMaker file account privilege as the employee login privilege'
);

assertContains(getSecurityInfo, /\$\$wvLoginAccount/, 'GetSecurityInfo must report the Web Viewer login account');
assertContains(getSecurityInfo, /\$\$wvLoginPrivilegeSet/, 'GetSecurityInfo must report the Web Viewer login privilege');
assertNotContains(
  getSecurityInfo,
  /Get\s*\(\s*AccountPrivilegeSetName\s*\)/,
  'GetSecurityInfo must not present the FileMaker file account as the employee login privilege'
);

console.log('security contract ok');
