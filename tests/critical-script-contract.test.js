const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scriptsDir = path.join(root, ' FileMakerScripts');

function readScript(name) {
  return fs.readFileSync(path.join(scriptsDir, name), 'utf8');
}

function activeLines(name) {
  return readScript(name)
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed !== '' && !trimmed.startsWith('#') && !trimmed.startsWith('//');
    });
}

function activeScript(name) {
  return activeLines(name).join('\n');
}

function indexOfOrFail(haystack, needle, message) {
  const index = haystack.indexOf(needle);
  assert.notStrictEqual(index, -1, message || `Expected to find ${needle}`);
  return index;
}

function assertBefore(script, earlier, later, message) {
  const earlierIndex = indexOfOrFail(script, earlier, `Expected to find ${earlier}`);
  const laterIndex = indexOfOrFail(script, later, `Expected to find ${later}`);
  assert(
    earlierIndex < laterIndex,
    message || `Expected ${earlier} to appear before ${later}`,
  );
}

function lineIndexOrFail(lines, predicate, message, start = 0) {
  const index = lines.findIndex((line, i) => i >= start && predicate(line));
  assert.notStrictEqual(index, -1, message);
  return index;
}

function assertFailClosedMutationGuard(scriptName, callbackName) {
  const lines = activeLines(scriptName);
  const executeIndex = lineIndexOrFail(
    lines,
    (line) => line.includes('Execute FileMaker Data API'),
    `${scriptName} must execute the Data API only after authorization`,
  );
  const allowIndex = lineIndexOrFail(
    lines,
    (line) => line.includes('Set Variable [ $allow'),
    `${scriptName} must calculate $allow`,
  );
  const guardIndex = lineIndexOrFail(
    lines,
    (line) => line.includes('If [ not $allow ]'),
    `${scriptName} must branch on unauthorized access`,
    allowIndex + 1,
  );
  const unauthorizedIndex = lineIndexOrFail(
    lines,
    (line) => line.includes('unauthorized'),
    `${scriptName} must return an unauthorized response`,
    guardIndex + 1,
  );
  const callbackIndex = lineIndexOrFail(
    lines,
    (line) => line.includes(callbackName),
    `${scriptName} must notify the Web Viewer before exiting unauthorized calls`,
    unauthorizedIndex + 1,
  );
  const exitIndex = lineIndexOrFail(
    lines,
    (line) => line.includes('Exit Script [ Text Result: False ]'),
    `${scriptName} must exit before mutating unauthorized calls`,
    callbackIndex + 1,
  );
  const endGuardIndex = lineIndexOrFail(
    lines,
    (line) => line.trim() === 'End If',
    `${scriptName} must close the unauthorized guard before mutation setup`,
    exitIndex + 1,
  );

  assert(allowIndex < guardIndex, `${scriptName} must calculate $allow before the guard`);
  assert(guardIndex < unauthorizedIndex, `${scriptName} must build unauthorized response inside guard`);
  assert(unauthorizedIndex < callbackIndex, `${scriptName} must send unauthorized response to callback`);
  assert(callbackIndex < exitIndex, `${scriptName} must callback before exiting unauthorized calls`);
  assert(exitIndex < endGuardIndex, `${scriptName} must exit inside the unauthorized guard`);
  assert(endGuardIndex < executeIndex, `${scriptName} must finish authorization guard before Data API mutation`);
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

test('GetData strips password fields before returning rows to JavaScript', () => {
  const script = activeScript('GetData.txt');
  assertBefore(
    script,
    'JSONDeleteElement',
    'receiveDataFromFileMaker',
    'GetData must remove sensitive fields before the Web Viewer callback',
  );
  assertBefore(
    script,
    'fieldData.パスワード',
    'receiveDataFromFileMaker',
    'GetData must target the password field before the Web Viewer callback',
  );
});

test('DeleteRecord enforces edit/delete authorization before Data API deletion', () => {
  assertFailClosedMutationGuard('DeleteRecord.txt', 'receiveDeleteResult');
});

test('UpdateEmployeeDataAPI enforces edit/delete authorization before Data API update', () => {
  assertFailClosedMutationGuard('UpdateEmployeeDataAPI.txt', 'receiveUpdateResult');
});

test('LoginValidate rejects blank account or password before account lookup', () => {
  const lines = activeLines('LoginValidate.txt');
  const blankCheckIndex = lineIndexOrFail(
    lines,
    (line) => line.includes('If [ IsEmpty ( $account ) or IsEmpty ( $password ) ]'),
    'LoginValidate must check for blank credentials',
  );
  const errorIndex = lineIndexOrFail(
    lines,
    (line) => line.includes('Set Variable [ $errorCode ; Value: "wrong_password" ]'),
    'LoginValidate must set a failure result for blank credentials',
    blankCheckIndex + 1,
  );
  const elseIndex = lineIndexOrFail(
    lines,
    (line) => line.trim() === 'Else',
    'LoginValidate must put the Data API lookup in the non-empty credential branch',
    errorIndex + 1,
  );
  const executeIndex = lineIndexOrFail(
    lines,
    (line) => line.includes('Execute FileMaker Data API'),
    'LoginValidate must perform the account lookup only after the non-empty Else branch',
    elseIndex + 1,
  );

  assert(
    !lines.slice(blankCheckIndex + 1, elseIndex).some((line) => line.includes('Execute FileMaker Data API')),
    'LoginValidate must not perform a Data API lookup before rejecting blank credentials',
  );
  assert(blankCheckIndex < errorIndex, 'LoginValidate must reject blank credentials inside the blank check');
  assert(errorIndex < elseIndex, 'LoginValidate must skip lookup by placing it in the Else branch');
  assert(elseIndex < executeIndex, 'LoginValidate must perform lookup only for non-empty credentials');
});
