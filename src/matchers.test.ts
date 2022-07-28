import { describe, test, expect, it } from 'vitest';
import { match, hostToRegex, pathToRegex } from './matchers';


describe('match', () => {
  test('should match if no constraints are provided', () => {
    expect(match(new Request('http://test.io'), {})).toEqual({ target: {}, params: {}});
  });

  test('it does not match if leaf matchers are empty', () => {
    expect(match(new Request('http://test.io'), { match: [] })).not.toBeDefined();
  });

  test('should match if leaf matcher matches', () => {
    expect(match(new Request('http://test.io'), { match: [{}] })).toEqual({ target: {}, params: {} });
  });

  describe('method matching', () => {
    test('it should match a single verb', () => {
      expect(match(new Request('http://11.io', { method: 'POST' }), { method: 'POST' })).toBeDefined();
      expect(match(new Request('http://11.io', { method: 'POST' }), { method: 'post' })).toBeDefined();
      expect(match(new Request('http://11.io', { method: 'POST' }), { method: 'GET' })).not.toBeDefined();
    });

    test('it should match an array of verbs', () => {
      const matcher = { method: ['POST', 'patch']};
      expect(match(new Request('http://11.io', { method: 'POST' }), matcher)).toBeDefined();
      expect(match(new Request('http://11.io', { method: 'PATCH' }), matcher)).toBeDefined();
      expect(match(new Request('http://11.io', { method: 'DELETE' }), matcher)).not.toBeDefined();
    });

    test('* matches any verb', () => {
      const matcher = { method: '*' };
      expect(match(new Request('http://11.io', { method: 'GET' }), matcher)).toBeDefined();
      expect(match(new Request('http://11.io', { method: 'POST' }), matcher)).toBeDefined();
      expect(match(new Request('http://11.io', { method: 'OPTIONS' }), matcher)).toBeDefined();
      expect(match(new Request('http://11.io', { method: 'HEAD' }), matcher)).toBeDefined();
    });
  });

  describe('protocol matching', () => {
    test('it should match a single protocol', () => {
      const matcher = { protocol: 'http' };
      expect(match(new Request('http://11.io'), matcher)).toBeDefined();
      expect(match(new Request('https://11.io'), matcher)).not.toBeDefined();
    });

    test('it should match an array of protocols', () => {
      const matcher = { protocol: ['http', 'https'] };
      expect(match(new Request('http://11.io'), matcher)).toBeDefined();
      expect(match(new Request('https://11.io'), matcher)).toBeDefined();
      expect(match(new Request('ftp://11.io'), matcher)).not.toBeDefined();
      expect(match(new Request('ws://11.io'), matcher)).not.toBeDefined();
    });

    test('* should match any protocol', () => {
      const matcher = { protocol: '*' };
      expect(match(new Request('http://11.io'), matcher)).toBeDefined();
      expect(match(new Request('https://11.io'), matcher)).toBeDefined();
      expect(match(new Request('ftp://11.io'), matcher)).toBeDefined();
      expect(match(new Request('ws://11.io'), matcher)).toBeDefined();
    });
  });

  describe('matching protocol and method', () => {
    test('both need to match', () => {
      const matcher = { method: 'POST', protocol: 'http' };
      expect(match(new Request('http://11.io', { method: 'DELETE' }), matcher)).not.toBeDefined();
      expect(match(new Request('https://11.io', { method: 'POST' }), matcher)).not.toBeDefined();
      expect(match(new Request('http://11.io', { method: 'POST' }), matcher)).toBeDefined();
    });
  });

  describe('host matching', () => {
    test('it matches the host', () => {
      const matcher = { host: 'test.io' };
      expect(match(new Request('http://test.io'), matcher)).toBeDefined();
      expect(match(new Request('http://test.io/path'), matcher)).toBeDefined();

      expect(match(new Request('ws://test.ion'), matcher)).not.toBeDefined();
      expect(match(new Request('http://hello.test.io'), matcher)).not.toBeDefined();
      expect(match(new Request('http://test.ion'), matcher)).not.toBeDefined();
    });

    test('host with port', () => {
      const matcher = { host: 'localhost:3000' };
      expect(match(new Request('http://localhost:3000'), matcher)).toBeDefined();
    });

    test('it matches with parameters', () => {
      const matcher = { host: '*sub.test.io' };
      expect(match(new Request('http://api.test.io'), matcher)).toBeDefined();
      expect(match(new Request('https://admin.test.io/path'), matcher)).toBeDefined();

      expect(match(new Request('http://test.io'), matcher)).not.toBeDefined();
      expect(match(new Request('https://hello.admin.test.io/path'), matcher)).not.toBeDefined();
    });

    test('it returns matched variables', () => {
      const matcher = { host: '*sub.test.io' };
      let v1 = match(new Request('http://api.test.io'), matcher);
      let v2 = match(new Request('https://admin.test.io/path'), matcher);

      expect(v1?.params?.sub).toBe('api');
      expect(v2?.params?.sub).toBe('admin');
    });

    test('it can match multiple vars', () => {
      const matcher = { host: '*sub.*env.test.io' };
      let v1 = match(new Request('http://api.staging.test.io'), matcher);
      let v2 = match(new Request('https://admin.prod.test.io/path'), matcher);

      expect(v1).toEqual({ target: {}, params: { sub: 'api', env: 'staging' } });
      expect(v2).toEqual({ target: {}, params: { sub: 'admin', env: 'prod' } });
    });

    test('it matches wildcard domains', () => {
      const matcher = { host: '*.test.io' };
      let v1 = match(new Request('http://prod.test.io'), matcher);
      expect(v1).toEqual({ target: {}, params: {} });
    })
  });

  describe('protocol and host matching', () => {
    test('it matches against both host and protocol', () => {
      const matcher = { protocol: 'https', host: '*sub.test.io' };
      expect(match(new Request('http://api.test.io'), matcher)).not.toBeDefined();
      expect(match(new Request('https://hello.api.test.io'), matcher)).not.toBeDefined();

      expect(match(new Request('https://api.test.io'), matcher)).toBeDefined();
    });
  });

  describe('path matching', () => {
    test('it matches an exact path', () => {
      const matcher = { path: '/api/user' };
      expect(match(new Request('http://test.io/api/user'), matcher)).toBeDefined();
      expect(match(new Request('http://test.io/api/'), matcher)).not.toBeDefined();
      expect(match(new Request('http://test.io/api/user/bob'), matcher)).not.toBeDefined();
    });

    test('it matches with path variables', () => {
      const matcher = { path: '/api/:entity' };
      expect(match(new Request('http://test.io/api/user'), matcher)).toBeDefined();
      expect(match(new Request('http://test.io/api/account'), matcher)).toBeDefined();

      expect(match(new Request('http://test.io/api/'), matcher)).not.toBeDefined();
      expect(match(new Request('http://test.io/api/account/profile'), matcher)).not.toBeDefined();
    });

    test('it matches with trailing wildcards', () => {
      const matcher = { path: '/api/account/*' };
      expect(match(new Request('http://test.io/api/account'), matcher)).toBeDefined();
      expect(match(new Request('http://test.io/api/account/profile'), matcher)).toBeDefined();

      expect(match(new Request('http://test.io/api/user'), matcher)).not.toBeDefined();
      expect(match(new Request('http://test.io/api/'), matcher)).not.toBeDefined();
    });

    test('returns matched variables', () => {
      const matcher = { path: '/api/:entity' };
      let v1 = match(new Request('http://test.io/api/user'), matcher);
      let v2 = match(new Request('http://test.io/api/account'), matcher);
      expect(v1?.params?.entity).toBe('user');
      expect(v2?.params?.entity).toBe('account');
    });
  });

  describe('protocol, host, and path matching', () => {
    test('it matches', () => {
      const matcher = { protocol: 'https', host: 'test.io', path: '/admin' };
      expect(match(new Request('https://test.io/admin'), matcher)).toEqual({ target: {}, params: {} });
      expect(match(new Request('http://test.io/admin'), matcher)).not.toBeDefined();
      expect(match(new Request('https://sub.test.io/admin'), matcher)).not.toBeDefined();
      expect(match(new Request('https://test.io/admin/profile'), matcher)).not.toBeDefined();
    });

    test('it returns variables', () => {
      const matcher = { protocol: 'https', host: '*env.test.io', path: '/:acc/:entity' };
      expect(match(new Request('https://prod.test.io/admin/user'), matcher)).toEqual({
        target: {},
        params: {
          env: 'prod',
          acc: 'admin',
          entity: 'user'
        }
      });
      expect(match(new Request('https://dev.test.io/qa/mapping'), matcher)).toEqual({
        target: {},
        params: {
          env: 'dev',
          acc: 'qa',
          entity: 'mapping'
        }
      });
    });
  });

  describe('nested matching', () => {
    test('it does not match if leaf matcher does not match', () => {
      const config = { host: 'localhost:5432', match: [{ path: '/test' }] };
      const r1 = match(new Request('http://localhost:5432'), config);
      const r2 = match(new Request('http://localhost:5432/test'), config);
      const r3 = match(new Request('http://localhost:5432/test/hello'), config);
      expect(r1).not.toBeDefined();
      expect(r2).toEqual({ target: {}, params: {} });
      expect(r3).not.toBeDefined();
    });
  });

  describe('target', () => {
    test('it returns the target', () => {
      const config = { target: { host: 'localhost:8787' } };
      expect(match(new Request('http://127.0.0.1:5000'), config)).toEqual({ target: { host: 'localhost:8787' }, params: {} });
    });
  });
});

describe('hostToRegex', () => {
  test('host matcher', () => {
    let re = hostToRegex('*sub.example.com');
    let match = 'subdomain.example.com'.match(re);
    expect(match).not.toBeNull();
    expect(match?.[0]).toBe('subdomain.example.com');
    expect(match?.[1]).toBe('subdomain');
  });

  test('host matcher', () => {
    let re = hostToRegex('*domain.*tld');
    expect('subdomain.example.com'.match(re)).toBeNull();
    expect('example.com'.match(re)?.groups).toEqual({ domain: 'example', tld: 'com' });
  });
});

describe('pathToRegex', () => {
  test('it matches', () => {
    const re = pathToRegex('/hello');
    {
      let match = '/hello'.match(re)
      expect(match?.[0]).toBe('/hello');
    }

    {
      let match = '/hello/world'.match(re)
      expect(match).toBeNull();
    }
  });

  test('longer path', () => {
    const re = pathToRegex('/hello/world');
    {
      let match = '/hello/world'.match(re)
      expect(match?.[0]).toBe('/hello/world');
    }

    {
      let match = '/hello'.match(re)
      expect(match).toBeNull();
    }
  });

  test('path variables', () => {
    const re = pathToRegex('/hello/:world');
    {
      let match = '/hello/earth'.match(re)
      expect(match?.[0]).toBe('/hello/earth');
      expect(match?.[1]).toBe('earth');
    }

    {
      let match = '/hello/mars'.match(re)
      expect(match?.[0]).toBe('/hello/mars');
      expect(match?.[1]).toBe('mars');
    }

    {
      let match = '/hello/earth/people'.match(re)
      expect(match).toBeNull();
    }
  });

  test('trailing wildcard', () => {
    const re = pathToRegex('/hello/*');

    {
      let match = '/hello'.match(re);
      expect(match?.[0]).toBe('/hello');
    }

    {
      let match = '/hello/world'.match(re);
      expect(match?.[0]).toBe('/hello/world');
    }

    {
      let match = '/hello/mars/alien'.match(re);
      expect(match?.[0]).toBe('/hello/mars/alien');
    }
  });
});
