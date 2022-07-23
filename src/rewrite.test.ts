import { describe, expect, test } from 'vitest';
import { rewriteHost } from './rewrite';

describe('rewriteHost', () => {
  test('basic rewrite', () => {
    let url = new URL('http://test.io');
    const rw = rewriteHost(url, { host: 'example.com' });
    expect(rw.host).toBe('example.com');
  });

  test('it replaces params', () => {
    let url = new URL('http://staging.test.io');
    let rw = rewriteHost(url, { host: ':env.test.io' }, { env: 'prod' });
    expect(rw.host).toBe('prod.test.io');
  });

  test('it replaces multiple params', () => {
    let url = new URL('http://staging.test.io');
    let rw = rewriteHost(url, { host: ':sub.:env.:sub.test.io' }, { env: 'prod', sub: 'admin' });
    expect(rw.host).toBe('admin.prod.admin.test.io');
  });
});