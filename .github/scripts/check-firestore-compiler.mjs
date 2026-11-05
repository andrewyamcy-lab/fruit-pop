import { readFileSync } from 'node:fs';

// The emulator can start even when a ruleset has errors. Verify the ACTUAL
// compiler endpoint, including a negative control, rather than only startup.
const url = 'http://127.0.0.1:18888/emulator/v1/projects/demo-friendarcade:securityRules';
async function compile(rules) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ content: rules }] } })
  });
  return { ok: response.ok, code: response.status, body: await response.text() };
}
const deliberatelyInvalid =
  "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { allow read: if ); } }";
const negative = await compile(deliberatelyInvalid);
if (negative.ok) {
  throw new Error('Rules compiler did not reject deliberately malformed syntax. This CI test cannot be trusted.');
}
console.log('Negative syntax control rejected by compiler: HTTP ' + negative.code);

const actual = readFileSync('firestore.rules', 'utf8');
const result = await compile(actual);
if (!result.ok) {
  throw new Error('Firestore compiler rejected firestore.rules: HTTP ' + result.code + '\n' + result.body);
}
console.log('SUCCESS: Firestore compiler accepted current firestore.rules (HTTP ' + result.code + ')');
