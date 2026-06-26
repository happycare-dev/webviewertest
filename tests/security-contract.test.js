const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scriptDir = path.join(root, ' FileMakerScripts');

function readScript(name) {
  return fs.readFileSync(path.join(scriptDir, name), 'utf8');
}

function executableText(name) {
  return readScript(name)
    .split(/\r?\n/)
    .filter((line) => !/^\s*(#|\/\/)/.test(line))
    .join('\n');
}

function indexOfRequired(text, needle, label) {
  const idx = text.indexOf(needle);
  assert.notStrictEqual(idx, -1, `${label} is missing: ${needle}`);
  return idx;
}

function assertBefore(text, earlier, later, label) {
  const earlyIdx = indexOfRequired(text, earlier, label);
  const laterIdx = indexOfRequired(text, later, label);
  assert(
    earlyIdx < laterIdx,
    `${label} must place ${earlier} before ${later}`
  );
}

function assertLoginStateContract() {
  const text = executableText('LoginValidate.txt');

  [
    '$$wvLoginAccount',
    '$$wvLoginPrivilegeSet',
    '$$wvLoginCanEditDelete'
  ].forEach((globalName) => {
    assert(
      new RegExp(`Set Variable \\[ \\${globalName.replace('$', '\\$')} ; Value: "" \\]`).test(text) ||
        new RegExp(`Set Variable \\[ \\${globalName.replace('$', '\\$')} ; Value: 0 \\]`).test(text),
      `LoginValidate must clear ${globalName} before validating credentials`
    );
  });

  assert(
    /Set Variable \[ \$loginPrivilegeSet ; Value: JSONGetElement \( \$result ; "response\.data\[0\]\.fieldData\.アクセス権セット" \) \]/.test(text),
    'LoginValidate must read the employee privilege set from EmployeeM'
  );
  assert(
    /Set Variable \[ \$\$wvLoginAccount ; Value: \$loginAccount \]/.test(text),
    'LoginValidate must persist the authenticated employee account'
  );
  assert(
    /Set Variable \[ \$\$wvLoginPrivilegeSet ; Value: \$loginPrivilegeSet \]/.test(text),
    'LoginValidate must persist the authenticated employee privilege set'
  );
  assert(
    /Set Variable \[ \$\$wvLoginCanEditDelete ; Value: Case \(/.test(text),
    'LoginValidate must derive edit/delete capability from the employee privilege set'
  );
  assertBefore(
    text,
    'Set Variable [ $$wvLoginAccount ; Value: $loginAccount ]',
    'Go to Layout [ "WebViewerTest" ; Animation: None ]',
    'LoginValidate authenticated state'
  );
}

function assertReadScriptsRequireLogin() {
  ['GetData.txt', 'GetLocations.txt'].forEach((name) => {
    const text = executableText(name);
    assertBefore(
      text,
      'If [ IsEmpty ( $$wvLoginAccount ) ]',
      name === 'GetData.txt' ? 'Execute FileMaker Data API' : 'ExecuteSQL',
      `${name} login guard`
    );
    assert(
      /Exit Script \[ Text Result: False \]/.test(text),
      `${name} must exit after rejecting unauthenticated access`
    );
  });
}

function assertPasswordNeverReturned() {
  const text = executableText('GetData.txt');
  assertBefore(
    text,
    'JSONDeleteElement',
    'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "receiveDataFromFileMaker"',
    'GetData password stripping'
  );
  assert(
    /fieldData\.パスワード/.test(text),
    'GetData must explicitly remove fieldData.パスワード before returning Data API results'
  );
}

function assertCapabilitiesUseLoginState() {
  const uiText = executableText('GetUiCapabilities.txt');
  assert(
    /Set Variable \[ \$allow ; Value: \$\$wvLoginCanEditDelete \]/.test(uiText),
    'GetUiCapabilities must use login-derived edit/delete capability'
  );
  assert(
    !/Get \( AccountPrivilegeSetName \)/.test(uiText),
    'GetUiCapabilities must not authorize from the FileMaker account privilege set'
  );

  const securityText = executableText('GetSecurityInfo.txt');
  assert(
    /"accountName" ; \$\$wvLoginAccount/.test(securityText),
    'GetSecurityInfo must report the authenticated employee account'
  );
  assert(
    /"privilegeSetName" ; \$\$wvLoginPrivilegeSet/.test(securityText),
    'GetSecurityInfo must report the authenticated employee privilege set'
  );
}

function assertMutationsRequireEditPermission() {
  ['DeleteRecord.txt', 'UpdateEmployeeDataAPI.txt'].forEach((name) => {
    const text = executableText(name);
    assertBefore(
      text,
      'If [ $$wvLoginCanEditDelete ≠ 1 ]',
      'Execute FileMaker Data API',
      `${name} edit/delete guard`
    );
    assert(
      /Exit Script \[ Text Result: False \]/.test(text),
      `${name} must exit after rejecting unauthorized mutation`
    );
  });
}

const tests = [
  assertLoginStateContract,
  assertReadScriptsRequireLogin,
  assertPasswordNeverReturned,
  assertCapabilitiesUseLoginState,
  assertMutationsRequireEditPermission
];

for (const test of tests) {
  test();
}

console.log(`security contract checks passed (${tests.length})`);
