const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scriptsDir = path.join(root, ' FileMakerScripts');

function readScript(name) {
  return fs.readFileSync(path.join(scriptsDir, name), 'utf8');
}

function activeScript(name) {
  return readScript(name)
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed !== '' && !trimmed.startsWith('#') && !trimmed.startsWith('//');
    })
    .join('\n');
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
  const script = activeScript('DeleteRecord.txt');
  assertBefore(
    script,
    '$allow',
    'Execute FileMaker Data API',
    'DeleteRecord must calculate an authorization decision before deletion',
  );
  assertBefore(
    script,
    'unauthorized',
    'Execute FileMaker Data API',
    'DeleteRecord must fail closed before deletion when unauthorized',
  );
});

test('UpdateEmployeeDataAPI enforces edit/delete authorization before Data API update', () => {
  const script = activeScript('UpdateEmployeeDataAPI.txt');
  assertBefore(
    script,
    '$allow',
    'Execute FileMaker Data API',
    'UpdateEmployeeDataAPI must calculate an authorization decision before updating',
  );
  assertBefore(
    script,
    'unauthorized',
    'Execute FileMaker Data API',
    'UpdateEmployeeDataAPI must fail closed before updating when unauthorized',
  );
});

test('LoginValidate rejects blank account or password before account lookup', () => {
  const script = activeScript('LoginValidate.txt');
  assertBefore(
    script,
    'IsEmpty ( $account ) or IsEmpty ( $password )',
    'Execute FileMaker Data API',
    'LoginValidate must reject blank credentials before lookup',
  );
});
