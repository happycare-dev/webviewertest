const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPTS_DIR = path.join(ROOT, ' FileMakerScripts');

function readScript(name) {
  return fs.readFileSync(path.join(SCRIPTS_DIR, name), 'utf8');
}

function activeScriptText(name) {
  return readScript(name)
    .split(/\r?\n/)
    .filter((line) => !/^\s*(#|\/\/)/.test(line))
    .join('\n');
}

function assertIncludes(text, needle, message) {
  assert.ok(text.includes(needle), `${message}\nMissing: ${needle}`);
}

function assertBefore(text, first, second, message) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);

  assert.notEqual(firstIndex, -1, `${message}\nMissing first marker: ${first}`);
  assert.notEqual(secondIndex, -1, `${message}\nMissing second marker: ${second}`);
  assert.ok(
    firstIndex < secondIndex,
    `${message}\nExpected "${first}" before "${second}"`
  );
}

function assertNotIncludes(text, needle, message) {
  assert.equal(text.includes(needle), false, `${message}\nUnexpected: ${needle}`);
}

{
  const text = activeScriptText('LoginValidate.txt');

  assertBefore(
    text,
    'Set Variable [ $$wvLoginAccount ; Value: "" ]',
    'Execute FileMaker Data API',
    'LoginValidate must clear any previous trusted login before looking up credentials.'
  );
  assertBefore(
    text,
    'Set Variable [ $$wvLoginPrivilegeSet ; Value: "" ]',
    'Execute FileMaker Data API',
    'LoginValidate must clear any previous trusted privilege before looking up credentials.'
  );
  assertBefore(
    text,
    'Set Variable [ $$wvLoginCanEditDelete ; Value: 0 ]',
    'Execute FileMaker Data API',
    'LoginValidate must clear any previous edit/delete authorization before looking up credentials.'
  );
  assertIncludes(
    text,
    'JSONGetElement ( $result ; "response.data[0].fieldData.アカウント" )',
    'LoginValidate must bind the trusted session to the matched EmployeeM account.'
  );
  assertIncludes(
    text,
    'JSONGetElement ( $result ; "response.data[0].fieldData.アクセス権セット" )',
    'LoginValidate must derive trusted authorization from the matched EmployeeM privilege set.'
  );
  assertBefore(
    text,
    'Set Variable [ $$wvLoginAccount',
    'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "receiveLoginResult"',
    'LoginValidate must store trusted session globals before reporting login success.'
  );
}

{
  const text = activeScriptText('GetData.txt');

  assertBefore(
    text,
    'If [ IsEmpty ( $$wvLoginAccount ) ]',
    'Execute FileMaker Data API',
    'GetData must reject unauthenticated Web Viewer calls before reading EmployeeM.'
  );
  assertBefore(
    text,
    'JSONDeleteElement ( $result ; "response.data[" & $i & "].fieldData.パスワード" )',
    'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "receiveDataFromFileMaker"',
    'GetData must remove password fields before returning EmployeeM records to JavaScript.'
  );
}

{
  const text = activeScriptText('GetLocations.txt');

  assertBefore(
    text,
    'If [ IsEmpty ( $$wvLoginAccount ) ]',
    'ExecuteSQL',
    'GetLocations must reject unauthenticated Web Viewer calls before reading location values.'
  );
}

{
  const text = activeScriptText('GetUiCapabilities.txt');

  assertIncludes(
    text,
    '$$wvLoginCanEditDelete',
    'GetUiCapabilities must use trusted login-derived edit/delete authorization.'
  );
  assertNotIncludes(
    text,
    'Get ( AccountPrivilegeSetName )',
    'GetUiCapabilities must not authorize against the underlying FileMaker file account.'
  );
}

{
  const text = activeScriptText('GetSecurityInfo.txt');

  assertIncludes(
    text,
    '$$wvLoginAccount',
    'GetSecurityInfo must report the Web Viewer login account, not the underlying FileMaker file account.'
  );
  assertIncludes(
    text,
    '$$wvLoginPrivilegeSet',
    'GetSecurityInfo must report the Web Viewer login privilege, not the underlying FileMaker file privilege.'
  );
}

for (const scriptName of ['UpdateEmployeeDataAPI.txt', 'DeleteRecord.txt']) {
  const text = activeScriptText(scriptName);

  assertBefore(
    text,
    'If [ $$wvLoginCanEditDelete ≠ 1 ]',
    'Execute FileMaker Data API',
    `${scriptName} must reject unauthorized Web Viewer calls before mutating EmployeeM.`
  );
}

console.log('security contract checks passed');
