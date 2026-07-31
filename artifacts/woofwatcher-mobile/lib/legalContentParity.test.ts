import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  PRIVACY_POLICY_MARKDOWN,
  TERMS_OF_SERVICE_MARKDOWN,
} from './legalContent.ts';

function normalizeMarkdown(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

test('the in-app privacy policy matches the reviewed source document', () => {
  const source = readFileSync(
    new URL('../../../docs/legal/PRIVACY_POLICY.md', import.meta.url),
    'utf8',
  );

  assert.equal(
    normalizeMarkdown(PRIVACY_POLICY_MARKDOWN),
    normalizeMarkdown(source),
  );
});

test('the in-app terms match the reviewed source document', () => {
  const source = readFileSync(
    new URL('../../../docs/legal/TERMS_OF_SERVICE.md', import.meta.url),
    'utf8',
  );

  assert.equal(
    normalizeMarkdown(TERMS_OF_SERVICE_MARKDOWN),
    normalizeMarkdown(source),
  );
});
