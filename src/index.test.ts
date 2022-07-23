import { describe, test, expect } from 'vitest';
import { proxy  } from './';

describe('proxy', () => {
  test('Returns undefined if there is no match', () => {
    const req = new Request('http://localhost:3010/test');
    const proxied = proxy(req, { match: [] });
    expect(proxied).not.toBeDefined();
  });

  describe('host matching', () => {
    test('successful match', () => {
      const config = { match: [{ host: 'localhost:3010' }] };
      const req = new Request('http://localhost:3010/test');
      const proxied = proxy(req, config);
      expect(proxied).toBeDefined();
      expect(proxied?.url).toBe('http://localhost:3010/test');
    });

    test('failure to match', () => {
      const config = { match: [{ host: '127.0.0.1:5432' }] };
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
});