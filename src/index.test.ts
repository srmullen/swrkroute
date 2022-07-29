import { describe, test, expect } from 'vitest';
import { proxy  } from './';

describe('proxy', () => {
  // Is this how it should work? What is the best behavior here?
  test('Returns undefined if there is no match', () => {
    const req = new Request('http://localhost:3010/test');
    const proxied = proxy(req, { match: [] });
    expect(proxied).not.toBeDefined();
  });

  describe('host matching', () => {
    test('successful match', () => {
      const config = { protocol: 'http', match: [{ host: 'localhost:3010' }] };
      const req = new Request('http://localhost:3010/test');
      const proxied = proxy(req, config);
      expect(proxied).toBeDefined();
      expect(proxied?.url).toBe('http://localhost:3010/test');
    });

    test('failure to match', () => {
      const config = { host: '127.0.0.1:5432', match: [{ path: '/test' }] };
      const req = new Request('http://localhost:3010/test');
      const proxied = proxy(req, config);
      expect(proxied).not.toBeDefined();
    });

    test('wildcard host', () => {
      const config = { match: [{ host: '*.example.com' }] };
      expect(proxy(new Request('http://example.com'), config)).not.toBeDefined();
      expect(proxy(new Request('http://subdomain.example.com'), config)).toBeDefined();
    });

    test('it rewrites the host', () => {
      const config = {
        target: {
          host: 'api.example.com'
        },
        match: [
          { host: 'example.com' }
        ]
      };

      const rw = proxy(new Request('http://example.com'), config);
      expect(rw?.url).toBe('http://api.example.com/');
    });
  });

  describe('top-level matcher', () => {
    test('it matches host', () => {
      const config = { host: 'test.io', target: { host: 'api.test.io' } };
      const rw = proxy(new Request('http://test.io'), config);
      expect(rw?.url).toBe('http://api.test.io/');
    });
  });

  describe('nested rewriting', () => {
    test('it rewrites with the nested target', () => {
      const config = { match: [{ target: { host: 'localhost:8787' } }]};
      const rw = proxy(new Request('http://api.worker.io'), config);
      expect(rw?.url).toBe('http://localhost:8787/');
    });

    test('it overwrites a previous target property', () => {
      const config = { target: { host: 'localhost:5555' }, match: [{ target: { host: 'localhost:4444' } }] };
      const rw = proxy(new Request('http://api.worker.io'), config);
      expect(rw?.url).toBe('http://localhost:4444/');
    });

    test('it merges different properties', () => {
      const config = { target: { host: 'localhost:5555' }, match: [{ target: { protocol: 'https' } }] };
      const rw = proxy(new Request('http://api.worker.io'), config);
      expect(rw?.url).toBe('https://localhost:5555/');
    });
  });

  describe('Use as a router', () => {
    const config = {
      target: { protocol: 'https', host: 'api.example.com', path: '/' },
      match: [
        { method: 'GET', path: '/api' },
        { method: 'POST', path: '/api' },
        { method: 'PUT', path: '/api' },
        { method: 'DELETE', path: '/api' },
      ]
    };

    test('it rewrites requests to /api to the api host', () => {
      const r1 = proxy(new Request('http://test.io/api'), config);
      expect(r1?.url).toBe('https://api.example.com/');
    });
  });
});