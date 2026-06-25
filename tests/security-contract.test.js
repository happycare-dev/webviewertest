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

function assertOrdered(text, patterns, message) {
  let cursor = 0;
  patterns.forEach((pattern) => {
    const match = text.slice(cursor).match(pattern);
    assert(match, `${message}: missing pattern ${pattern}`);
    cursor += match.index + match[0].length;
  });
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
assertNotContains(
  loginValidate,
  /Get\s*\(\s*AccountPrivilegeSetName\s*\)/,
  'LoginValidate must not derive Web Viewer permissions from the FileMaker file account'
);
assertBefore(
  loginValidate,
  /Set Variable \[ \$\$wvLoginAccount ; Value: "" \]/,
  /Execute FileMaker Data API/,
  'LoginValidate must clear prior trusted login state before validating a new login'
);

const passwordCheckIndex = indexOfPattern(loginValidate, /If \[ not Exact\s*\(\s*\$storedPw\s*;\s*\$password\s*\)\s*\]/);
assert.notStrictEqual(passwordCheckIndex, -1, 'LoginValidate must compare the submitted password before setting trusted state');
const beforePasswordCheck = loginValidate.slice(0, passwordCheckIndex);
assertNotContains(
  beforePasswordCheck,
  /Set Variable \[ \$\$wvLoginAccount ; Value: (?!"" \])/,
  'LoginValidate must not set a trusted login account before password validation succeeds'
);
assertNotContains(
  beforePasswordCheck,
  /Set Variable \[ \$\$wvLoginPrivilegeSet ; Value: (?!"" \])/,
  'LoginValidate must not set a trusted login privilege before password validation succeeds'
);
assertNotContains(
  beforePasswordCheck,
  /Set Variable \[ \$\$wvLoginCanEditDelete ; Value: (?!False \])/,
  'LoginValidate must not grant edit/delete before password validation succeeds'
);
assertOrdered(
  loginValidate,
  [
    /If \[ not Exact\s*\(\s*\$storedPw\s*;\s*\$password\s*\)\s*\]/,
    /Else/,
    /Set Variable \[ \$loginAccount ; Value: JSONGetElement\s*\(\s*\$result\s*;\s*"response\.data\[0\]\.fieldData\.アカウント"\s*\) \]/,
    /Set Variable \[ \$loginPrivilege ; Value: JSONGetElement\s*\(\s*\$result\s*;\s*"response\.data\[0\]\.fieldData\.アクセス権セット"\s*\) \]/,
    /Set Variable \[ \$loginCanEditDelete ; Value: Case\s*\([\s\S]*?\$loginPrivilege[\s\S]*?\) \]/,
    /Set Variable \[ \$\$wvLoginAccount ; Value: \$loginAccount \]/,
    /Set Variable \[ \$\$wvLoginPrivilegeSet ; Value: \$loginPrivilege \]/,
    /Set Variable \[ \$\$wvLoginCanEditDelete ; Value: \$loginCanEditDelete \]/,
    /Set Variable \[ \$loginSuccess ; Value: 1 \]/
  ],
  'LoginValidate must set trusted state only in the successful password-validation branch'
);

assertContains(getData, /\$\$wvLoginAccount/, 'GetData must require a successful Web Viewer login');
assertBefore(
  getData,
  /IsEmpty\s*\(\s*\$\$wvLoginAccount\s*\)/,
  /Execute FileMaker Data API/,
  'GetData must fail closed before reading EmployeeM data'
);
assertOrdered(
  getData,
  [
    /Execute FileMaker Data API/,
    /Set Variable \[ \$i ; Value: 0 \]/,
    /Set Variable \[ \$count ; Value: ValueCount\s*\(\s*JSONListKeys\s*\(\s*\$result\s*;\s*"response\.data"\s*\)\s*\) \]/,
    /Loop \[ Flush: Always \]/,
    /Exit Loop If \[ \$i ≥ \$count \]/,
    /JSONDeleteElement\s*\(\s*\$result\s*;\s*"response\.data\["\s*&\s*\$i\s*&\s*"\]\.fieldData\.パスワード"\s*\)/,
    /Set Variable \[ \$i ; Value: \$i \+ 1 \]/,
    /End Loop/,
    /Perform JavaScript in Web Viewer/
  ],
  'GetData must strip employee passwords from every returned row before sending results to JavaScript'
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
