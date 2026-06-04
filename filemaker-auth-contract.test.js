const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = __dirname;

function readScript(name) {
  return fs.readFileSync(path.join(root, ' FileMakerScripts', name), 'utf8');
}

function executableSteps(script) {
  return script
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('#') && !line.trimStart().startsWith('//'))
    .join('\n');
}

function assertIncludes(script, needle, label) {
  assert(
    script.includes(needle),
    `${label}: expected to include ${JSON.stringify(needle)}`
  );
}

function assertBefore(script, before, after, label) {
  const beforeIndex = script.indexOf(before);
  const afterIndex = script.indexOf(after);
  assert(beforeIndex !== -1, `${label}: missing ${JSON.stringify(before)}`);
  assert(afterIndex !== -1, `${label}: missing ${JSON.stringify(after)}`);
  assert(
    beforeIndex < afterIndex,
    `${label}: expected ${JSON.stringify(before)} before ${JSON.stringify(after)}`
  );
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(err.stack || err.message);
    process.exitCode = 1;
  }
}

test('LoginValidate creates trusted app session state only after credentials pass', () => {
  const script = readScript('LoginValidate.txt');
  const steps = executableSteps(script);

  assertBefore(
    steps,
    'Set Variable [ $$wvLoginAccount ; Value: "" ]',
    'Execute FileMaker Data API',
    'LoginValidate must clear stale auth before validating a new login'
  );
  assertBefore(
    steps,
    'Set Variable [ $$wvLoginPrivilegeSet ; Value: $employeePriv ]',
    'Set Variable [ $okOut ; Value: JSONSetElement',
    'LoginValidate must bind the authenticated employee before success callback'
  );
  assertBefore(
    steps,
    'Set Variable [ $$wvLoginCanEditDelete ; Value: Case (',
    'Go to Layout [ "WebViewerTest" ; Animation: None ]',
    'LoginValidate must derive app permissions before entering the app layout'
  );
});

test('GetUiCapabilities uses the login-issued app session, not the opening FileMaker account', () => {
  const script = readScript('GetUiCapabilities.txt');
  const steps = executableSteps(script);

  assertIncludes(steps, '$$wvLoginAccount', 'GetUiCapabilities');
  assertIncludes(steps, '$$wvLoginCanEditDelete', 'GetUiCapabilities');
  assertBefore(
    steps,
    'If [ IsEmpty ( $$wvLoginAccount ) ]',
    'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "receiveUiCapabilities"',
    'GetUiCapabilities must deny unauthenticated app sessions'
  );
  assert(
    !/Get\s*\(\s*AccountPrivilegeSetName\s*\)/.test(steps),
    'GetUiCapabilities must not grant edit/delete based on the FileMaker account that opened the file'
  );
});

test('GetData refuses to return employee rows before successful Web Viewer login', () => {
  const script = readScript('GetData.txt');
  const steps = executableSteps(script);

  assertBefore(
    steps,
    'If [ IsEmpty ( $$wvLoginAccount ) ]',
    'Execute FileMaker Data API',
    'GetData must enforce login before reading EmployeeM records'
  );
});

test('mutating scripts require login-issued edit/delete authorization before Data API writes', () => {
  ['UpdateEmployeeDataAPI.txt', 'DeleteRecord.txt'].forEach((name) => {
    const script = readScript(name);
    const steps = executableSteps(script);
    assertBefore(
      steps,
      'If [ IsEmpty ( $$wvLoginAccount ) or $$wvLoginCanEditDelete \u2260 True ]',
      'Execute FileMaker Data API',
      `${name} must enforce login-issued edit/delete authorization before mutation`
    );
  });
});

test('GetSecurityInfo reports the effective logged-in employee identity when available', () => {
  const script = readScript('GetSecurityInfo.txt');
  const steps = executableSteps(script);

  assertIncludes(steps, '$$wvLoginAccount', 'GetSecurityInfo');
  assertIncludes(steps, '$$wvLoginPrivilegeSet', 'GetSecurityInfo');
  assertBefore(
    steps,
    'Set Variable [ $effectiveAccount ; Value: Case (',
    'Set Variable [ $json ; Value: JSONSetElement',
    'GetSecurityInfo must compute effective app identity before building JSON'
  );
  assertIncludes(
    steps,
    '[ "fileMakerAccountName" ; Get ( AccountName ) ; JSONString ]',
    'GetSecurityInfo'
  );
});
