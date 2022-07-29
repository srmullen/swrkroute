import { describe, expect, test } from 'vitest';
import { rewrite, rewriteProtocol, rewriteHost, rewritePath, rewriteHeaders } from './rewrite';

describe('URL rewriting', () => {
  describe('rewriteHost', () => {
    test('basic rewrite', () => {
      let url = new URL('http://test.io');
      rewriteHost(url, 'example.com');
      expect(url.host).toBe('example.com');
    });
  
    test('it replaces params', () => {
      let url = new URL('http://staging.test.io');
      // let rw = rewriteHost(url, { host: ':env.test.io' }, { env: 'prod' });
      rewriteHost(url, ':env.test.io', { env: 'prod' });
      expect(url.host).toBe('prod.test.io');
    });
  
    test('it replaces multiple params', () => {
      let url = new URL('http://staging.test.io');
      // let rw = rewriteHost(url, { host: ':sub.:env.:sub.test.io' }, { env: 'prod', sub: 'admin' });
      rewriteHost(url, ':sub.:env.:sub.test.io', { env: 'prod', sub: 'admin' });
      expect(url.host).toBe('admin.prod.admin.test.io');
    });
  });

  describe('rewriteProtocol', () => {
    test('it changes http to https', () => {
      const url = new URL('http://example.com');
      rewriteProtocol(url, 'https');
      expect(url.toString()).toBe('https://example.com/');
    });
  });

  describe('pathRewrite', () => {
    test('if the target path is just a string it should replace the path', () => {
      const url = new URL('http://example.com/hello');
      const rw = rewritePath(url, '/world', {});
      expect(rw.toString()).toBe('http://example.com/world');
    });

    test('it replaces path vars with params', () => {
      const url = new URL('http://example.com/hello/world');
      const rw = rewritePath(url, '/hello/:planet', { planet: 'mars' });
      expect(rw.toString()).toBe('http://example.com/hello/mars');
    });

    test('rewrite rules replaces matching regex', () => {
      const url = new URL('http://example.com/hello/world');
      const rw = rewritePath(url, { '^/hello': '/goodbye'}, {});
      expect(rw.toString()).toBe('http://example.com/goodbye/world');
    });

    test('rewrite ', () => {
      const url = new URL('http://example.com/hello/world');
      const rw = rewritePath(url, { '^/hello': '/goodbye/:adj'}, { adj: 'cruel'});
      expect(rw.toString()).toBe('http://example.com/goodbye/cruel/world');
    });
  });

  describe('rewriteHeaders', () => {
    describe('Add headers', () => {
      test('add static header', () => {
        const headers = new Headers();
        const rw = rewriteHeaders(headers, { 'Authorization': 'Bearer abc123' }, {});
        expect(rw.get('Authorization')).toBe('Bearer abc123');
      });
    });

    describe('Remove header', () => {
      test('A null value removes the header', () => {
        const headers = new Headers({ 'Authorization': 'Bearer abc123' });
        const rw = rewriteHeaders(headers, { 'Authorization': null }, {});
        expect(rw.get('Authorization')).toBe(null);
      })
    });
  });

  describe('rewrite', () => {
    test('it rewrites protocol, host, port, method, and headers', () => {
      const target = {
        protocol: 'https',
        host: 'localhost',
        port: '8787',
        path: '/api',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer abc123'
        }
      };

      const req = new Request('http://example.com', { 
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      const rw = rewrite(req, target);
      expect(rw.method).toBe('POST');
      expect(rw.url).toBe('https://localhost:8787/api');
      expect(rw.headers.get('Authorization')).toBe('Bearer abc123');
      expect(rw.headers.get('Accept')).toBe('application/json');
    });

    test('it preserves the body', async () => {
      const target = {
        host: 'localhost:8787'
      };

      const req = new Request('https://example.com/api', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      });
      const rw = rewrite(req, target);
      expect(await rw.json()).toEqual({ email: 'test@example.com' });
    });
  });
});