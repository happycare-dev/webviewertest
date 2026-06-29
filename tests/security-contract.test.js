const assert = require('assert');
const fs = require('fs');
const path = require('path');

const scriptsDir = path.join(__dirname, '..', ' FileMakerScripts');

function activeScript(name) {
  const raw = fs.readFileSync(path.join(scriptsDir, name), 'utf8');
  return raw
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//');
    })
    .join('\n');
}

function assertIncludes(text, needle, label) {
  assert(
    text.includes(needle),
    `${label || 'script'} should include: ${needle}`
  );
}

function assertExcludes(text, needle, label) {
  assert(
    !text.includes(needle),
    `${label || 'script'} should not include: ${needle}`
  );
}

function assertBefore(text, earlier, later, label) {
  const earlierIndex = text.indexOf(earlier);
  const laterIndex = text.indexOf(later);
  assert.notStrictEqual(
    earlierIndex,
    -1,
    `${label || 'script'} should include earlier text: ${earlier}`
  );
  assert.notStrictEqual(
    laterIndex,
    -1,
    `${label || 'script'} should include later text: ${later}`
  );
  assert(
    earlierIndex < laterIndex,
    `${label || 'script'} should place "${earlier}" before "${later}"`
  );
}

function assertAfter(text, needle, anchor, label) {
  const anchorIndex = text.indexOf(anchor);
  assert.notStrictEqual(
    anchorIndex,
    -1,
    `${label || 'script'} should include anchor text: ${anchor}`
  );
  const needleIndex = text.indexOf(needle, anchorIndex + anchor.length);
  assert.notStrictEqual(
    needleIndex,
    -1,
    `${label || 'script'} should include "${needle}" after "${anchor}"`
  );
}

function assertOrderAfter(text, anchor, earlier, later, label) {
  const anchorIndex = text.indexOf(anchor);
  assert.notStrictEqual(
    anchorIndex,
    -1,
    `${label || 'script'} should include anchor text: ${anchor}`
  );
  const earlierIndex = text.indexOf(earlier, anchorIndex + anchor.length);
  const laterIndex = text.indexOf(later, anchorIndex + anchor.length);
  assert.notStrictEqual(
    earlierIndex,
    -1,
    `${label || 'script'} should include "${earlier}" after "${anchor}"`
  );
  assert.notStrictEqual(
    laterIndex,
    -1,
    `${label || 'script'} should include "${later}" after "${anchor}"`
  );
  assert(
    earlierIndex < laterIndex,
    `${label || 'script'} should place "${earlier}" before "${later}" after "${anchor}"`
  );
}

function assertGuardExits(text, guard, label) {
  const start = text.indexOf(guard);
  assert.notStrictEqual(
    start,
    -1,
    `${label || 'script'} should include guard: ${guard}`
  );
  const end = text.indexOf('End If', start + guard.length);
  assert.notStrictEqual(
    end,
    -1,
    `${label || 'script'} should close guard: ${guard}`
  );
  const block = text.slice(start, end);
  assert(
    block.includes('Exit Script [ Text Result: False ]'),
    `${label || 'script'} should exit false inside guard: ${guard}`
  );
}

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('LoginValidate clears and stores trusted login state from validated EmployeeM credentials', () => {
  const script = activeScript('LoginValidate.txt');

  assertBefore(script, 'Set Variable [ $$wvLoginAccount ; Value: "" ]', 'Execute FileMaker Data API', 'LoginValidate');
  assertBefore(script, 'Set Variable [ $$wvLoginPrivilegeSet ; Value: "" ]', 'Execute FileMaker Data API', 'LoginValidate');
  assertBefore(script, 'Set Variable [ $$wvLoginCanEditDelete ; Value: False ]', 'Execute FileMaker Data API', 'LoginValidate');
  assertBefore(script, 'If [ IsEmpty ( $account ) or IsEmpty ( $password ) ]', 'Execute FileMaker Data API', 'LoginValidate');

  assertIncludes(script, 'response.data[0].fieldData.アクセス権セット', 'LoginValidate');
  assertAfter(script, 'Set Variable [ $$wvLoginAccount ; Value: $account ]', 'Exact ( $storedPw ; $password )', 'LoginValidate');
  assertAfter(script, 'Set Variable [ $$wvLoginPrivilegeSet ; Value: $priv ]', 'Exact ( $storedPw ; $password )', 'LoginValidate');
  assertAfter(script, 'Set Variable [ $$wvLoginCanEditDelete ; Value: Case (', 'Exact ( $storedPw ; $password )', 'LoginValidate');
  assertBefore(script, 'Set Variable [ $$wvLoginAccount ; Value: $account ]', 'Go to Layout [ "WebViewerTest" ; Animation: None ]', 'LoginValidate');
});

test('read scripts require a trusted login before returning EmployeeM data', () => {
  const getData = activeScript('GetData.txt');
  const getLocations = activeScript('GetLocations.txt');

  assertGuardExits(getData, 'If [ IsEmpty ( $$wvLoginAccount ) ]', 'GetData');
  assertBefore(getData, 'If [ IsEmpty ( $$wvLoginAccount ) ]', 'Execute FileMaker Data API', 'GetData');
  assertOrderAfter(getData, 'If [ IsEmpty ( $$wvLoginAccount ) ]', 'Exit Script [ Text Result: False ]', 'Execute FileMaker Data API', 'GetData');

  assertGuardExits(getLocations, 'If [ IsEmpty ( $$wvLoginAccount ) ]', 'GetLocations');
  assertBefore(getLocations, 'If [ IsEmpty ( $$wvLoginAccount ) ]', 'ExecuteSQL', 'GetLocations');
  assertOrderAfter(getLocations, 'If [ IsEmpty ( $$wvLoginAccount ) ]', 'Exit Script [ Text Result: False ]', 'ExecuteSQL', 'GetLocations');
});

test('GetData strips password fields before invoking the Web Viewer callback', () => {
  const script = activeScript('GetData.txt');

  assertBefore(script, 'Execute FileMaker Data API', 'JSONDeleteElement ( $result ; "response.data[" & $i & "].fieldData.パスワード" )', 'GetData');
  assertOrderAfter(script, 'Execute FileMaker Data API', 'JSONDeleteElement ( $result ; "response.data[" & $i & "].fieldData.パスワード" )', 'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "receiveDataFromFileMaker"', 'GetData');
});

test('capability and security info scripts use authenticated employee state, not the opening FileMaker account', () => {
  const capabilities = activeScript('GetUiCapabilities.txt');
  const securityInfo = activeScript('GetSecurityInfo.txt');

  assertIncludes(capabilities, '$$wvLoginCanEditDelete', 'GetUiCapabilities');
  assertExcludes(capabilities, 'Get ( AccountPrivilegeSetName )', 'GetUiCapabilities');

  assertIncludes(securityInfo, '$$wvLoginAccount', 'GetSecurityInfo');
  assertIncludes(securityInfo, '$$wvLoginPrivilegeSet', 'GetSecurityInfo');
  assertExcludes(securityInfo, 'Get ( AccountName )', 'GetSecurityInfo');
  assertExcludes(securityInfo, 'Get ( AccountPrivilegeSetName )', 'GetSecurityInfo');
});

test('mutation scripts enforce authenticated edit/delete capability before Data API writes', () => {
  [
    ['UpdateEmployeeDataAPI.txt', '"action" ; "update"'],
    ['DeleteRecord.txt', '"action" ; "delete"']
  ].forEach(([name, action]) => {
    const script = activeScript(name);
    assertGuardExits(script, 'If [ $$wvLoginCanEditDelete ≠ True ]', name);
    assertBefore(script, 'If [ $$wvLoginCanEditDelete ≠ True ]', action, name);
    assertBefore(script, 'If [ $$wvLoginCanEditDelete ≠ True ]', 'Execute FileMaker Data API', name);
    assertOrderAfter(script, 'If [ $$wvLoginCanEditDelete ≠ True ]', 'Exit Script [ Text Result: False ]', action, name);
    assertOrderAfter(script, 'If [ $$wvLoginCanEditDelete ≠ True ]', 'Exit Script [ Text Result: False ]', 'Execute FileMaker Data API', name);
  });
});

let failed = 0;

tests.forEach(({ name, fn }) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(err && err.stack ? err.stack : err);
  }
});

if (failed) {
  process.exitCode = 1;
}
