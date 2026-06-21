const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scriptsDir = path.join(root, ' FileMakerScripts');

function readScript(name) {
  return fs.readFileSync(path.join(scriptsDir, name), 'utf8');
}

function assertContains(text, needle, message) {
  assert(
    text.includes(needle),
    `${message}\nMissing: ${needle}`
  );
}

function assertBefore(text, first, second, message) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  assert(firstIndex !== -1, `${message}\nMissing first marker: ${first}`);
  assert(secondIndex !== -1, `${message}\nMissing second marker: ${second}`);
  assert(
    firstIndex < secondIndex,
    `${message}\nExpected "${first}" before "${second}"`
  );
}

function assertNoPasswordLeak(script) {
  assertContains(
    script,
    'JSONDeleteElement ( $result ; "response.data[" & $i & "].fieldData.パスワード" )',
    'GetData must remove password fields before returning records to JavaScript.'
  );
  assertBefore(
    script,
    'JSONDeleteElement ( $result ; "response.data[" & $i & "].fieldData.パスワード" )',
    'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "receiveDataFromFileMaker"',
    'Password removal must happen before the Web Viewer callback.'
  );
}

function assertLoginRequired(script, scriptName, callbackName, dataAccessMarker = 'Execute FileMaker Data API') {
  assertContains(
    script,
    'If [ IsEmpty ( $$wvLoginAccount ) ]',
    `${scriptName} must require a validated Web Viewer login.`
  );
  assertBefore(
    script,
    'If [ IsEmpty ( $$wvLoginAccount ) ]',
    dataAccessMarker,
    `${scriptName} must fail closed before Data API access.`
  );
  assertBefore(
    script,
    'If [ IsEmpty ( $$wvLoginAccount ) ]',
    `Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "${callbackName}"`,
    `${scriptName} must check login before returning data.`
  );
}

function assertMutationAuthorized(script, scriptName, callbackName) {
  assertContains(
    script,
    'If [ $$wvLoginCanEditDelete ≠ 1 ]',
    `${scriptName} must require login-derived edit/delete permission.`
  );
  assertBefore(
    script,
    'If [ $$wvLoginCanEditDelete ≠ 1 ]',
    'Execute FileMaker Data API',
    `${scriptName} must reject unauthorized calls before mutation.`
  );
  assertBefore(
    script,
    'If [ $$wvLoginCanEditDelete ≠ 1 ]',
    `Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "${callbackName}"`,
    `${scriptName} must send an unauthorized result without mutating.`
  );
}

const loginValidate = readScript('LoginValidate.txt');
const getData = readScript('GetData.txt');
const getLocations = readScript('GetLocations.txt');
const getUiCapabilities = readScript('GetUiCapabilities.txt');
const getSecurityInfo = readScript('GetSecurityInfo.txt');
const updateEmployee = readScript('UpdateEmployeeDataAPI.txt');
const deleteRecord = readScript('DeleteRecord.txt');

[
  '$$wvLoginAccount',
  '$$wvLoginPrivilegeSet',
  '$$wvLoginCanEditDelete'
].forEach((globalName) => {
  assertContains(
    loginValidate,
    `Set Variable [ ${globalName} ; Value: "" ]`,
    `LoginValidate must clear ${globalName} before each login attempt.`
  );
});

assertContains(
  loginValidate,
  'fieldData.アクセス権セット',
  'LoginValidate must derive privileges from the matched employee record, not the FileMaker account.'
);
assertContains(
  loginValidate,
  'Set Variable [ $$wvLoginAccount ; Value: $account ]',
  'LoginValidate must persist the validated employee account.'
);
assertContains(
  loginValidate,
  'Set Variable [ $$wvLoginPrivilegeSet ; Value: $privilegeSet ]',
  'LoginValidate must persist the validated employee privilege set.'
);
assertContains(
  loginValidate,
  'Set Variable [ $$wvLoginCanEditDelete ; Value: Case (',
  'LoginValidate must derive edit/delete capability from the employee privilege set.'
);
assertBefore(
  loginValidate,
  'Set Variable [ $$wvLoginCanEditDelete ; Value: Case (',
  'Set Variable [ $okOut ; Value: JSONSetElement ( "{}" ; [ "ok" ; True ; JSONBoolean ] ) ]',
  'Trusted login globals must be set before the success callback and layout change.'
);

assertLoginRequired(getData, 'GetData', 'receiveDataFromFileMaker');
assertNoPasswordLeak(getData);
assertLoginRequired(getLocations, 'GetLocations', 'receiveLocations', 'ExecuteSQL(');

assertContains(
  getUiCapabilities,
  'Set Variable [ $allow ; Value: $$wvLoginCanEditDelete = 1 ]',
  'GetUiCapabilities must report the login-derived capability.'
);
assertContains(
  getSecurityInfo,
  '[ "accountName" ; $$wvLoginAccount ; JSONString ]',
  'GetSecurityInfo must display the validated employee account.'
);
assertContains(
  getSecurityInfo,
  '[ "privilegeSetName" ; $$wvLoginPrivilegeSet ; JSONString ]',
  'GetSecurityInfo must display the validated employee privilege set.'
);

assertMutationAuthorized(updateEmployee, 'UpdateEmployeeDataAPI', 'receiveUpdateResult');
assertMutationAuthorized(deleteRecord, 'DeleteRecord', 'receiveDeleteResult');

console.log('Security contract checks passed.');
