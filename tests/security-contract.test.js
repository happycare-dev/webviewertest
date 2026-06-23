const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scriptsDir = path.join(root, ' FileMakerScripts');

function readScript(name) {
  return fs.readFileSync(path.join(scriptsDir, name), 'utf8');
}

function assertContains(script, needle, label) {
  assert(
    script.includes(needle),
    `${label}: expected script to contain ${JSON.stringify(needle)}`
  );
}

function assertBefore(script, earlier, later, label) {
  const earlierIndex = script.indexOf(earlier);
  const laterIndex = script.indexOf(later);
  assert(
    earlierIndex >= 0,
    `${label}: missing earlier marker ${JSON.stringify(earlier)}`
  );
  assert(
    laterIndex >= 0,
    `${label}: missing later marker ${JSON.stringify(later)}`
  );
  assert(
    earlierIndex < laterIndex,
    `${label}: ${JSON.stringify(earlier)} must appear before ${JSON.stringify(later)}`
  );
}

function assertNotContains(script, needle, label) {
  assert(
    !script.includes(needle),
    `${label}: script must not contain ${JSON.stringify(needle)}`
  );
}

function assertBetween(script, earlier, middle, later, label) {
  const earlierIndex = script.indexOf(earlier);
  const middleIndex = script.indexOf(middle);
  const laterIndex = script.lastIndexOf(later);
  assert(
    earlierIndex >= 0,
    `${label}: missing earlier marker ${JSON.stringify(earlier)}`
  );
  assert(
    middleIndex >= 0,
    `${label}: missing middle marker ${JSON.stringify(middle)}`
  );
  assert(
    laterIndex >= 0,
    `${label}: missing later marker ${JSON.stringify(later)}`
  );
  assert(
    earlierIndex < middleIndex && middleIndex < laterIndex,
    `${label}: ${JSON.stringify(middle)} must appear between ${JSON.stringify(earlier)} and the final ${JSON.stringify(later)}`
  );
}

function testLoginValidateEstablishesTrustedSession() {
  const script = readScript('LoginValidate.txt');

  assertBefore(script, 'Set Variable [ $$wvLoginAccount ; Value: "" ]', 'Execute FileMaker Data API', 'LoginValidate clears account before validation');
  assertBefore(script, 'Set Variable [ $$wvLoginPrivilegeSet ; Value: "" ]', 'Execute FileMaker Data API', 'LoginValidate clears privilege before validation');
  assertBefore(script, 'Set Variable [ $$wvLoginCanEditDelete ; Value: 0 ]', 'Execute FileMaker Data API', 'LoginValidate clears edit/delete before validation');

  assertContains(script, 'fieldData.アクセス権セット', 'LoginValidate reads employee privilege set');
  assertBefore(script, 'Set Variable [ $$wvLoginAccount ; Value: $account ]', 'Go to Layout [ "WebViewerTest"', 'LoginValidate stores validated account before entering viewer');
  assertBefore(script, 'Set Variable [ $$wvLoginPrivilegeSet ; Value: $loginPrivilegeSet ]', 'Go to Layout [ "WebViewerTest"', 'LoginValidate stores validated privilege before entering viewer');
  assertBefore(script, 'Set Variable [ $$wvLoginCanEditDelete ; Value: $canEditDelete ]', 'Go to Layout [ "WebViewerTest"', 'LoginValidate stores validated edit/delete capability before entering viewer');
}

function testReadScriptsRequireTrustedLogin() {
  const dataScript = readScript('GetData.txt');
  assertBefore(dataScript, '$$wvLoginAccount', 'Execute FileMaker Data API', 'GetData requires a trusted login before reading data');

  const locationsScript = readScript('GetLocations.txt');
  assertBefore(locationsScript, '$$wvLoginAccount', 'ExecuteSQL', 'GetLocations requires a trusted login before reading locations');
}

function testGetDataStripsPasswordsBeforeCallback() {
  const script = readScript('GetData.txt');

  assertBetween(script, 'Execute FileMaker Data API', 'JSONDeleteElement', 'receiveDataFromFileMaker', 'GetData sanitizes Data API response before Web Viewer callback');
  assertBetween(script, 'Execute FileMaker Data API', 'fieldData.パスワード', 'receiveDataFromFileMaker', 'GetData removes password field before Web Viewer callback');
}

function testCapabilitiesUseTrustedLoginState() {
  const uiScript = readScript('GetUiCapabilities.txt');
  const securityScript = readScript('GetSecurityInfo.txt');

  assertContains(uiScript, '$$wvLoginCanEditDelete', 'GetUiCapabilities uses login-derived edit/delete capability');
  assertNotContains(uiScript, 'Get ( AccountPrivilegeSetName )', 'GetUiCapabilities must not trust outer FileMaker account');

  assertContains(securityScript, '$$wvLoginAccount', 'GetSecurityInfo reports login-derived account');
  assertContains(securityScript, '$$wvLoginPrivilegeSet', 'GetSecurityInfo reports login-derived privilege');
}

function testMutationsRequireTrustedEditDeleteBeforeDataApi() {
  ['UpdateEmployeeDataAPI.txt', 'DeleteRecord.txt'].forEach((name) => {
    const script = readScript(name);
    assertBefore(script, '$$wvLoginCanEditDelete', 'Execute FileMaker Data API', `${name} checks trusted edit/delete capability before mutation`);
  });
}

testLoginValidateEstablishesTrustedSession();
testReadScriptsRequireTrustedLogin();
testGetDataStripsPasswordsBeforeCallback();
testCapabilitiesUseTrustedLoginState();
testMutationsRequireTrustedEditDeleteBeforeDataApi();

console.log('security contract checks passed');
