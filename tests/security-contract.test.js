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

function assertBeforeLast(text, earlier, later, message) {
  const earlierIndex = text.indexOf(earlier);
  const laterIndex = text.lastIndexOf(later);
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
    `${message}\nExpected "${earlier}" to appear before the final "${later}"`
  );
}

function assertGuardFailureBeforeOperation(scriptName, guardLine, callbackName, operationMarker, message) {
  const script = readScript(scriptName);
  const guardIndex = script.indexOf(guardLine);
  const callbackIndex = guardIndex === -1 ? -1 : script.indexOf(callbackName, guardIndex);
  const exitIndex = callbackIndex === -1 ? -1 : script.indexOf('Exit Script [ Text Result: False ]', callbackIndex);
  const operationIndex = script.lastIndexOf(operationMarker);

  assert(
    guardIndex !== -1,
    `${message}\nExpected to find guard: ${guardLine}`
  );
  assert(
    callbackIndex !== -1,
    `${message}\nExpected to find error callback after guard: ${callbackName}`
  );
  assert(
    exitIndex !== -1,
    `${message}\nExpected to find false exit after error callback.`
  );
  assert(
    operationIndex !== -1,
    `${message}\nExpected to find protected operation: ${operationMarker}`
  );
  assert(
    guardIndex < callbackIndex && callbackIndex < exitIndex && exitIndex < operationIndex,
    `${message}\nExpected guard, error callback, and false exit before protected operation.`
  );
}

function assertCanEditGuardBeforeDataApi(scriptName, callbackName) {
  assertGuardFailureBeforeOperation(
    scriptName,
    'If [ not $$wvLoginCanEditDelete ]',
    callbackName,
    'Execute FileMaker Data API',
    `${scriptName} must check login-derived edit/delete permission and exit before mutation.`
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
assertBefore(
  login,
  'Set Variable [ $$wvLoginAccount ; Value: "" ]',
  'Execute FileMaker Data API',
  'LoginValidate must clear trusted login state before credential validation.'
);
assertBefore(
  login,
  'Set Variable [ $$wvLoginPrivilegeSet ; Value: "" ]',
  'Execute FileMaker Data API',
  'LoginValidate must clear trusted privilege state before credential validation.'
);
assertBefore(
  login,
  'Set Variable [ $$wvLoginCanEditDelete ; Value: False ]',
  'Execute FileMaker Data API',
  'LoginValidate must clear trusted edit/delete state before credential validation.'
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

assertGuardFailureBeforeOperation(
  'GetData.txt',
  'If [ IsEmpty ( $$wvLoginAccount ) ]',
  'receiveDataFromFileMaker',
  'Execute FileMaker Data API',
  'GetData must reject unauthenticated calls before reading employee records.'
);
assertBeforeLast(
  readScript('GetData.txt'),
  'JSONDeleteElement ( $result ; "response.data[" & $i & "].fieldData.パスワード" )',
  'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "receiveDataFromFileMaker"',
  'GetData must strip password fields before returning records to JavaScript.'
);

assertGuardFailureBeforeOperation(
  'GetLocations.txt',
  'If [ IsEmpty ( $$wvLoginAccount ) ]',
  'receiveLocations',
  'ExecuteSQL',
  'GetLocations must reject unauthenticated calls before reading employee locations.'
);

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
