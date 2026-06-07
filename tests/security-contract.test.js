const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const scriptsDir = path.join(root, ' FileMakerScripts');

function readScript(name) {
  return fs.readFileSync(path.join(scriptsDir, name), 'utf8');
}

function assertContains(text, needle, label) {
  assert.ok(text.includes(needle), `${label} is missing: ${needle}`);
}

function assertNotContains(text, needle, label) {
  assert.ok(!text.includes(needle), `${label} must not contain: ${needle}`);
}

function assertBefore(text, earlier, later, label) {
  const early = text.indexOf(earlier);
  const late = text.indexOf(later);
  assert.notEqual(early, -1, `${label} is missing earlier marker: ${earlier}`);
  assert.notEqual(late, -1, `${label} is missing later marker: ${later}`);
  assert.ok(early < late, `${label} must place "${earlier}" before "${later}"`);
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('LoginValidate clears and sets trusted Web Viewer login globals', () => {
  const script = readScript('LoginValidate.txt');

  assertContains(script, 'Set Variable [ $$wvLoginAccount ; Value: "" ]', 'LoginValidate');
  assertContains(script, 'Set Variable [ $$wvLoginPrivilegeSet ; Value: "" ]', 'LoginValidate');
  assertContains(script, 'Set Variable [ $$wvLoginCanEditDelete ; Value: False ]', 'LoginValidate');
  assertContains(script, 'Set Variable [ $$wvLoginAccount ; Value: $account ]', 'LoginValidate');
  assertContains(script, 'Set Variable [ $$wvLoginPrivilegeSet ; Value: $priv ]', 'LoginValidate');
  assertContains(script, 'Set Variable [ $$wvLoginCanEditDelete ; Value: $allow ]', 'LoginValidate');
  assertBefore(script, 'Set Variable [ $$wvLoginAccount ; Value: $account ]', 'Set Variable [ $okOut', 'LoginValidate');
});

test('GetUiCapabilities reports only the trusted login capability', () => {
  const script = readScript('GetUiCapabilities.txt');

  assertContains(
    script,
    'Set Variable [ $allow ; Value: not IsEmpty ( $$wvLoginAccount ) and $$wvLoginCanEditDelete ]',
    'GetUiCapabilities'
  );
  assertNotContains(script, 'Get ( AccountPrivilegeSetName )', 'GetUiCapabilities');
});

test('GetData requires login and strips password fields before returning data', () => {
  const script = readScript('GetData.txt');

  assertBefore(script, 'If [ IsEmpty ( $$wvLoginAccount ) ]', 'Execute FileMaker Data API', 'GetData');
  assertContains(script, 'JSONDeleteElement', 'GetData');
  assertContains(script, 'fieldData.パスワード', 'GetData');
  assertContains(script, 'Set Variable [ $safeResult ; Value: $result ]', 'GetData');
  assertNotContains(script, 'Parameters: $result', 'GetData callback');
});

test('GetLocations requires a trusted login before exposing lookup data', () => {
  const script = readScript('GetLocations.txt');

  assertBefore(script, 'If [ IsEmpty ( $$wvLoginAccount ) ]', 'ExecuteSQL', 'GetLocations');
});

test('UpdateEmployeeDataAPI rejects unauthenticated or read-only callers before mutation', () => {
  const script = readScript('UpdateEmployeeDataAPI.txt');

  assertBefore(
    script,
    'If [ IsEmpty ( $$wvLoginAccount ) or not $$wvLoginCanEditDelete ]',
    'Execute FileMaker Data API [ Select',
    'UpdateEmployeeDataAPI'
  );
  assertContains(script, 'Not authorized to update records', 'UpdateEmployeeDataAPI');
});

test('DeleteRecord rejects unauthenticated or read-only callers before mutation', () => {
  const script = readScript('DeleteRecord.txt');

  assertBefore(
    script,
    'If [ IsEmpty ( $$wvLoginAccount ) or not $$wvLoginCanEditDelete ]',
    'Execute FileMaker Data API [ Select',
    'DeleteRecord'
  );
  assertContains(script, 'Not authorized to delete records', 'DeleteRecord');
});
