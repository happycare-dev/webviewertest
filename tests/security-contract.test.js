const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scriptsDir = path.join(root, ' FileMakerScripts');

function script(name) {
  return fs.readFileSync(path.join(scriptsDir, name), 'utf8');
}

function assertContains(text, needle, message) {
  assert.ok(text.includes(needle), message + '\nMissing: ' + needle);
}

function assertNotContains(text, needle, message) {
  assert.ok(!text.includes(needle), message + '\nUnexpected: ' + needle);
}

function assertBefore(text, before, after, message) {
  const beforeIndex = text.indexOf(before);
  const afterIndex = text.indexOf(after);
  assert.ok(beforeIndex !== -1, message + '\nMissing before marker: ' + before);
  assert.ok(afterIndex !== -1, message + '\nMissing after marker: ' + after);
  assert.ok(beforeIndex < afterIndex, message + '\nExpected "' + before + '" before "' + after + '"');
}

function assertBeforeLast(text, before, after, message) {
  const beforeIndex = text.indexOf(before);
  const afterIndex = text.lastIndexOf(after);
  assert.ok(beforeIndex !== -1, message + '\nMissing before marker: ' + before);
  assert.ok(afterIndex !== -1, message + '\nMissing after marker: ' + after);
  assert.ok(beforeIndex < afterIndex, message + '\nExpected "' + before + '" before last "' + after + '"');
}

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    console.error('not ok - ' + name);
    throw err;
  }
}

test('LoginValidate resets and records trusted Web Viewer login state', () => {
  const text = script('LoginValidate.txt');
  assertContains(text, '$$wvLoginAccount', 'login script must manage a trusted login account global');
  assertContains(text, '$$wvLoginPrivilegeSet', 'login script must capture the privilege set after successful password validation');
  assertContains(text, '$$wvLoginCanEditDelete', 'login script must capture edit/delete capability after successful password validation');
  assertBefore(
    text,
    'Set Variable [ $$wvLoginAccount ; Value: "" ]',
    'Execute FileMaker Data API',
    'stale login globals must be cleared before validating a new login attempt'
  );
  assertBefore(
    text,
    'Set Variable [ $$wvLoginCanEditDelete ; Value: Case (',
    'Set Variable [ $okOut ; Value: JSONSetElement',
    'capabilities must be established before the success callback and layout transition'
  );
});

test('GetUiCapabilities is derived only from trusted login state', () => {
  const text = script('GetUiCapabilities.txt');
  assertContains(text, '$$wvLoginCanEditDelete', 'UI capabilities must use login-derived capability state');
  assertNotContains(
    text,
    'Get ( AccountPrivilegeSetName )',
    'UI capabilities must not trust the ambient FileMaker account directly'
  );
});

test('GetSecurityInfo reports trusted Web Viewer login state', () => {
  const text = script('GetSecurityInfo.txt');
  assertContains(text, '[ "accountName" ; $$wvLoginAccount ; JSONString ]', 'security modal must show the validated Web Viewer login account');
  assertContains(text, '[ "privilegeSetName" ; $$wvLoginPrivilegeSet ; JSONString ]', 'security modal must show the validated Web Viewer privilege state');
  assertContains(text, '[ "canEditDelete" ; Case ( $$wvLoginCanEditDelete ; True ; False ) ; JSONBoolean ]', 'security modal must expose the login-derived edit/delete capability');
});

test('read scripts require a successful Web Viewer login', () => {
  const getData = script('GetData.txt');
  assertBefore(
    getData,
    'If [ IsEmpty ( $$wvLoginAccount ) ]',
    'Execute FileMaker Data API',
    'GetData must not expose employee records before LoginValidate succeeds'
  );

  const getLocations = script('GetLocations.txt');
  assertBefore(
    getLocations,
    'If [ IsEmpty ( $$wvLoginAccount ) ]',
    'ExecuteSQL',
    'GetLocations must not expose employee metadata before LoginValidate succeeds'
  );
});

test('GetData strips password field before returning records to JavaScript', () => {
  const text = script('GetData.txt');
  assertContains(text, 'JSONDeleteElement ( $result ; "response.data[" & $i & "].fieldData.パスワード" )', 'password fields must be removed from Data API result');
  assertBeforeLast(
    text,
    'JSONDeleteElement ( $result ; "response.data[" & $i & "].fieldData.パスワード" )',
    'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "receiveDataFromFileMaker"',
    'password fields must be removed before the Web Viewer callback receives the result'
  );
});

test('mutation scripts enforce server-side edit/delete authorization before Data API writes', () => {
  for (const [fileName, callbackName] of [
    ['UpdateEmployeeDataAPI.txt', 'receiveUpdateResult'],
    ['DeleteRecord.txt', 'receiveDeleteResult']
  ]) {
    const text = script(fileName);
    assertBefore(
      text,
      'If [ not $$wvLoginCanEditDelete ]',
      'Execute FileMaker Data API [',
      fileName + ' must check login-derived edit/delete capability before mutation'
    );
    assertBefore(
      text,
      'If [ not $$wvLoginCanEditDelete ]',
      'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "' + callbackName + '"',
      fileName + ' must return an authorization failure through its normal callback'
    );
  }
});
