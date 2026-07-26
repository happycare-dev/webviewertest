const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const loginValidatePath = path.join(root, ' FileMakerScripts', 'LoginValidate.txt');

function readLoginValidate() {
  return fs.readFileSync(loginValidatePath, 'utf8');
}

function stripFullLineComments(script) {
  return script
    .split(/\r?\n/)
    .filter((line) => !/^\s*\/\//.test(line) && !/^\s*#/.test(line))
    .join('\n');
}

test('LoginValidate rejects an empty account before querying EmployeeM', () => {
  const script = stripFullLineComments(readLoginValidate());
  const guard = script.indexOf('If [ IsEmpty ( $account ) ]');
  const query = script.indexOf('Execute FileMaker Data API');
  const exit = script.indexOf('Exit Script [ Text Result: False ]', guard);
  const endIf = script.indexOf('End If', exit);

  assert.notEqual(guard, -1, 'missing server-side empty-account guard');
  assert.ok(
    guard < exit && exit < endIf && endIf < query,
    'empty-account branch must terminate before EmployeeM lookup'
  );
});

test('LoginValidate uses an exact field match for the account find', () => {
  const script = stripFullLineComments(readLoginValidate());
  const exactQuery = script.indexOf(
    '[ "query[0].アカウント" ; "==" & $account ; JSONString ]'
  );
  const looseQuery = script.indexOf(
    '[ "query[0].アカウント" ; $account ; JSONString ]'
  );

  assert.notEqual(exactQuery, -1, 'account query must prefix the value with ==');
  assert.equal(
    looseQuery,
    -1,
    'loose account find must not remain; FileMaker treats * and prefixes as operators'
  );
});

test('LoginValidate Exact-checks the returned account before accepting a password match', () => {
  const script = stripFullLineComments(readLoginValidate());
  const storedAccount = script.indexOf(
    'Set Variable [ $storedAccount ; Value: JSONGetElement ( $result ; "response.data[0].fieldData.アカウント" ) ]'
  );
  const exactAccount = script.indexOf(
    'If [ not Exact ( $storedAccount ; $account ) ]',
    storedAccount
  );
  const passwordExact = script.indexOf(
    'If [ not Exact ( $storedPw ; $password ) ]',
    exactAccount
  );
  const loginSuccess = script.indexOf(
    'Set Variable [ $loginSuccess ; Value: 1 ]',
    passwordExact
  );

  assert.notEqual(storedAccount, -1, 'must capture the returned account field');
  assert.ok(
    storedAccount < exactAccount &&
      exactAccount < passwordExact &&
      passwordExact < loginSuccess,
    'returned account must Exact-match the submitted account before password acceptance'
  );
});
