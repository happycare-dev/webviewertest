const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scriptsDir = path.join(root, ' FileMakerScripts');

function readScript(name) {
  return fs.readFileSync(path.join(scriptsDir, name), 'utf8');
}

function executableText(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//');
    })
    .join('\n');
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

function testLoginStoresTrustedGlobals() {
  const script = executableText(readScript('LoginValidate.txt'));

  assertContains(
    script,
    'Set Variable [ $$wvLoginAccount',
    'LoginValidate must store the authenticated employee account after validation.'
  );
  assertContains(
    script,
    'Set Variable [ $$wvLoginPrivilegeSet',
    'LoginValidate must store the employee privilege set after validation.'
  );
  assertContains(
    script,
    'Set Variable [ $$wvLoginCanEditDelete',
    'LoginValidate must store the derived edit/delete capability after validation.'
  );
  assertContains(
    script,
    'fieldData.アクセス権セット',
    'LoginValidate must derive permissions from the authenticated EmployeeM row.'
  );
  assertBefore(
    script,
    'Set Variable [ $$wvLoginCanEditDelete',
    'Perform JavaScript in Web Viewer [ Object Name: "web" ; Function Name: "receiveLoginResult"',
    'Trusted login globals must be populated before the success callback/layout transition.'
  );
}

function testReadScriptsRequireLoginAndStripSecrets() {
  const getData = executableText(readScript('GetData.txt'));
  const getLocations = executableText(readScript('GetLocations.txt'));

  assertBefore(
    getData,
    'If [ IsEmpty ( $$wvLoginAccount ) ]',
    'Execute FileMaker Data API',
    'GetData must fail closed before fetching EmployeeM data when no employee is logged in.'
  );
  assertBefore(
    getData,
    'JSONDeleteElement',
    'Function Name: "receiveDataFromFileMaker"',
    'GetData must remove password fields before returning Data API JSON to the Web Viewer.'
  );
  assertContains(
    getData,
    'fieldData.パスワード',
    'GetData must explicitly remove EmployeeM password fields from each returned record.'
  );

  assertBefore(
    getLocations,
    'If [ IsEmpty ( $$wvLoginAccount ) ]',
    'ExecuteSQL',
    'GetLocations must not expose EmployeeM-derived location values before login.'
  );
}

function testMutationsRequireServerSideAuthorization() {
  ['UpdateEmployeeDataAPI.txt', 'DeleteRecord.txt'].forEach((name) => {
    const script = executableText(readScript(name));

    assertBefore(
      script,
      'If [ not $$wvLoginCanEditDelete ]',
      'Execute FileMaker Data API',
      `${name} must enforce edit/delete authorization before executing a Data API mutation.`
    );
  });
}

function testCapabilitiesUseTrustedLoginState() {
  const script = executableText(readScript('GetUiCapabilities.txt'));

  assertContains(
    script,
    '$$wvLoginCanEditDelete',
    'GetUiCapabilities must report the capability derived during employee login.'
  );
  assert(
    !script.includes('Get ( AccountPrivilegeSetName )'),
    'GetUiCapabilities must not authorize Web Viewer employees from the shared FileMaker session privilege set.'
  );
}

testLoginStoresTrustedGlobals();
testReadScriptsRequireLoginAndStripSecrets();
testMutationsRequireServerSideAuthorization();
testCapabilitiesUseTrustedLoginState();

console.log('security contract tests passed');
