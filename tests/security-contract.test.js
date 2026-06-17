const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT_DIR = path.join(ROOT, ' FileMakerScripts');

function readScript(name) {
  return fs.readFileSync(path.join(SCRIPT_DIR, name), 'utf8');
}

function assertContains(text, needle, message) {
  assert(
    text.includes(needle),
    `${message}\nExpected to find: ${needle}`
  );
}

function assertBefore(text, earlier, later, message) {
  const earlierIndex = text.indexOf(earlier);
  const laterIndex = text.indexOf(later);
  assert(
    earlierIndex !== -1,
    `${message}\nExpected to find earlier marker: ${earlier}`
  );
  assert(
    laterIndex !== -1,
    `${message}\nExpected to find later marker: ${later}`
  );
  assert(
    earlierIndex < laterIndex,
    `${message}\nExpected "${earlier}" to appear before "${later}"`
  );
}

function assertRejectsBeforeDataApi(scriptName, globalName, callbackName) {
  const script = readScript(scriptName);
  assertBefore(
    script,
    `If [ IsEmpty ( ${globalName} ) ]`,
    'Execute FileMaker Data API',
    `${scriptName} must reject unauthenticated calls before using the Data API.`
  );
  assertBefore(
    script,
    callbackName,
    'Exit Script [ Text Result: False ]',
    `${scriptName} must return an error callback when authorization fails.`
  );
}

function assertCanEditGuardBeforeDataApi(scriptName, callbackName) {
  const script = readScript(scriptName);
  assertBefore(
    script,
    'If [ not $$wvLoginCanEditDelete ]',
    'Execute FileMaker Data API',
    `${scriptName} must check login-derived edit/delete permission before mutation.`
  );
  assertBefore(
    script,
    callbackName,
    'Exit Script [ Text Result: False ]',
    `${scriptName} must return an error callback when permission is denied.`
  );
}

const login = readScript('LoginValidate.txt');
assertContains(
  login,
  'Set Variable [ $$wvLoginAccount ; Value: "" ]',
  'LoginValidate must clear trusted login state before validating credentials.'
);
assertContains(
  login,
  'Set Variable [ $$wvLoginPrivilegeSet ; Value: "" ]',
  'LoginValidate must clear trusted privilege state before validating credentials.'
);
assertContains(
  login,
  'Set Variable [ $$wvLoginCanEditDelete ; Value: False ]',
  'LoginValidate must clear trusted edit/delete state before validating credentials.'
);
assertContains(
  login,
  'Set Variable [ $$wvLoginAccount ; Value: $account ]',
  'LoginValidate must store the authenticated employee account on success.'
);
assertContains(
  login,
  'Set Variable [ $$wvLoginPrivilegeSet ; Value: JSONGetElement ( $result ; "response.data[0].fieldData.権限セット" ) ]',
  'LoginValidate must derive the privilege set from the validated EmployeeM row.'
);
assertContains(
  login,
  'Set Variable [ $$wvLoginCanEditDelete ; Value: Case (',
  'LoginValidate must derive edit/delete capability from the validated EmployeeM row.'
);
assertBefore(
  login,
  'Set Variable [ $$wvLoginAccount ; Value: $account ]',
  'Go to Layout [ "WebViewerTest" ; Animation: None ]',
  'LoginValidate must establish trusted login state before opening the viewer layout.'
);

assertRejectsBeforeDataApi('GetData.txt', '$$wvLoginAccount', 'receiveDataFromFileMaker');
assertBefore(
  readScript('GetData.txt'),
  'JSONDeleteElement ( $result ; "response.data[" & $i & "].fieldData.パスワード" )',
  'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "receiveDataFromFileMaker"',
  'GetData must strip password fields before returning records to JavaScript.'
);

assertRejectsBeforeDataApi('GetLocations.txt', '$$wvLoginAccount', 'receiveLocations');

const caps = readScript('GetUiCapabilities.txt');
assertContains(
  caps,
  'Set Variable [ $allow ; Value: $$wvLoginCanEditDelete ]',
  'GetUiCapabilities must use trusted login-derived capability, not the FileMaker file account.'
);

const security = readScript('GetSecurityInfo.txt');
assertContains(
  security,
  '[ "accountName" ; $$wvLoginAccount ; JSONString ]',
  'GetSecurityInfo must display the authenticated employee account.'
);
assertContains(
  security,
  '[ "privilegeSetName" ; $$wvLoginPrivilegeSet ; JSONString ]',
  'GetSecurityInfo must display the authenticated employee privilege set.'
);

assertCanEditGuardBeforeDataApi('UpdateEmployeeDataAPI.txt', 'receiveUpdateResult');
assertCanEditGuardBeforeDataApi('DeleteRecord.txt', 'receiveDeleteResult');

console.log('security-contract.test.js passed');
