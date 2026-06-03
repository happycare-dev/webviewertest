const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function readScript(name) {
  return fs.readFileSync(path.join(repoRoot, ' FileMakerScripts', name), 'utf8');
}

function textBeforeMutation(scriptText) {
  const mutationMatch = /^Execute FileMaker Data API/m.exec(scriptText);
  assert.ok(mutationMatch, 'script must execute the FileMaker Data API');
  return scriptText.slice(0, mutationMatch.index);
}

function assertRequiresUiCapability(scriptName) {
  const beforeMutation = textBeforeMutation(readScript(scriptName));

  assert.match(beforeMutation, /Get\s*\(\s*AccountPrivilegeSetName\s*\)/);
  assert.match(beforeMutation, /\$priv\s*=\s*"\[Full Access\]"/);
  assert.match(beforeMutation, /\$priv\s*=\s*"Admin"/);
  assert.match(beforeMutation, /\$priv\s*=\s*"Manager"/);
  assert.match(beforeMutation, /If\s*\[\s*not\s+\$allow\s*\]/);
  assert.match(beforeMutation, /not authorized/i);
  assert.match(beforeMutation, /Exit Script\s*\[\s*Text Result:\s*False\s*\]/);
}

test('DeleteRecord rejects unauthorized sessions before deleting through the Data API', () => {
  assertRequiresUiCapability('DeleteRecord.txt');
});

test('UpdateEmployeeDataAPI rejects unauthorized sessions before updating through the Data API', () => {
  assertRequiresUiCapability('UpdateEmployeeDataAPI.txt');
});
