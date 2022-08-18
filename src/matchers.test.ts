import { describe, test, expect, it } from 'vitest';
import { createMatcher, hostToRegex, pathToRegex } from './matchers';


describe('match', () => {
  test('should match if no constraints are provided', () => {
    const match = createMatcher({});
    expect(match(new Request('http://test.io'))).toEqual({ params: {} });
  });

  describe('method matching', () => {
    test('it should match a single verb', () => {
      const match = createMatcher({ method: 'POST' });
      expect(match(new Request('http://11.io', { method: 'POST' }))).toBeDefined();
      expect(match(new Request('http://11.io', { method: 'PATCH' }))).not.toBeDefined();
    });

    test('it should match an array of verbs', () => {
      const match = createMatcher({ method: ['POST', 'patch']})
      expect(match(new Request('http://11.io', { method: 'POST' }))).toBeDefined();
      expect(match(new Request('http://11.io', { method: 'PATCH' }))).toBeDefined();
      expect(match(new Request('http://11.io', { method: 'DELETE' }))).not.toBeDefined();
    });

    test('* matches any verb', () => {
      const match = createMatcher({ method: '*' });
      expect(match(new Request('http://11.io', { method: 'GET' }))).toBeDefined();
      expect(match(new Request('http://11.io', { method: 'POST' }))).toBeDefined();
      expect(match(new Request('http://11.io', { method: 'OPTIONS' }))).toBeDefined();
      expect(match(new Request('http://11.io', { method: 'HEAD' }))).toBeDefined();
    });
  });

  describe('protocol matching', () => {
    test('it should match a single protocol', () => {
      const match = createMatcher({ protocol: 'http' });
      expect(match(new Request('http://11.io'))).toBeDefined();
      expect(match(new Request('https://11.io'))).not.toBeDefined();
    });

    test('it should match an array of protocols', () => {
      const match = createMatcher({ protocol: ['http', 'https'] });
      expect(match(new Request('http://11.io'))).toBeDefined();
      expect(match(new Request('https://11.io'))).toBeDefined();
      expect(match(new Request('ftp://11.io'))).not.toBeDefined();
      expect(match(new Request('ws://11.io'))).not.toBeDefined();
    });

    test('* should match any protocol', () => {
      const match = createMatcher({ protocol: '*' });
      expect(match(new Request('http://11.io'))).toBeDefined();
      expect(match(new Request('https://11.io'))).toBeDefined();
      expect(match(new Request('ftp://11.io'))).toBeDefined();
      expect(match(new Request('ws://11.io'))).toBeDefined();
    });
  });

  describe('port matching', () => {
    test('it should match the port', () => {
      const match = createMatcher({ port: '8080' });
      expect(match(new Request('http://localhost:8080'))).toBeDefined();
      expect(match(new Request('http://localhost:3000'))).not.toBeDefined();
    });
  });

  describe('matching protocol and method', () => {
    test('both need to match', () => {
      const match = createMatcher({ method: 'POST', protocol: 'http' });
      expect(match(new Request('http://11.io', { method: 'DELETE' }))).not.toBeDefined();
      expect(match(new Request('https://11.io', { method: 'POST' }))).not.toBeDefined();
      expect(match(new Request('http://11.io', { method: 'POST' }))).toBeDefined();
    });
  });

  describe('host matching', () => {
    test('it matches the host', () => {
      const match = createMatcher({ host: 'test.io' });
      expect(match(new Request('http://test.io'))).toBeDefined();
      expect(match(new Request('http://test.io/path'))).toBeDefined();

      expect(match(new Request('ws://test.ion'))).not.toBeDefined();
      expect(match(new Request('http://hello.test.io'))).not.toBeDefined();
      expect(match(new Request('http://test.ion'))).not.toBeDefined();
    });

    test('host with port', () => {
      const match = createMatcher({ host: 'localhost:3000' });
      expect(match(new Request('http://localhost:3000'))).toBeDefined();
    });

    test('it matches with parameters', () => {
      const match = createMatcher({ host: '*sub.test.io' });
      expect(match(new Request('http://api.test.io'))).toBeDefined();
      expect(match(new Request('https://admin.test.io/path'))).toBeDefined();

      expect(match(new Request('http://test.io'))).not.toBeDefined();
      expect(match(new Request('https://hello.admin.test.io/path'))).not.toBeDefined();
    });

    test('it returns matched variables', () => {
      const match = createMatcher({ host: '*sub.test.io' });
      let v1 = match(new Request('http://api.test.io'));
      let v2 = match(new Request('https://admin.test.io/path'));

      expect(v1?.params?.sub).toBe('api');
      expect(v2?.params?.sub).toBe('admin');
    });

    test('it can match multiple vars', () => {
      const match = createMatcher({ host: '*sub.*env.test.io' });
      let v1 = match(new Request('http://api.staging.test.io'));
      let v2 = match(new Request('https://admin.prod.test.io/path'));

      expect(v1).toEqual({ params: { sub: 'api', env: 'staging' } });
      expect(v2).toEqual({ params: { sub: 'admin', env: 'prod' } });
    });

    test('it matches wildcard domains', () => {
      const match = createMatcher({ host: '*.test.io' });
      let v1 = match(new Request('http://prod.test.io'));
      expect(v1).toEqual({ params: {} });
    });

    test('wildcard matches hosts with "-" characters', () => {
      const wildcardMatch = createMatcher({ host: '*.test.io' });
      expect(wildcardMatch(new Request('http://-u.test.io'))).toEqual({ params: {} });
      expect(wildcardMatch(new Request('http://u-u.test.io'))).toEqual({ params: {} });
      expect(wildcardMatch(new Request('http://u-.test.io'))).toEqual({ params: {} });
    });

    test('named wildcard matches hosts with "-" characters', () => {
      const wildcardMatch = createMatcher({ host: '*sub.test.io' });
      expect(wildcardMatch(new Request('http://-u.test.io'))).toEqual({ params: { sub: '-u' } }); // Not technically a valid host
      expect(wildcardMatch(new Request('http://-u.test.io'))).toEqual({ params: { sub: '-u' } }); // Not technically a valid host
      expect(wildcardMatch(new Request('http://u-.test.io'))).toEqual({ params: { sub: 'u-' } }); 
      expect(wildcardMatch(new Request('http://u-u.test.io'))).toEqual({ params: { sub: 'u-u' } });
    });
  });

  describe('protocol and host matching', () => {
    test('it matches against both host and protocol', () => {
      const match = createMatcher({ protocol: 'https', host: '*sub.test.io' });
      expect(match(new Request('http://api.test.io'))).not.toBeDefined();
      expect(match(new Request('https://hello.api.test.io'))).not.toBeDefined();

      expect(match(new Request('https://api.test.io'))).toBeDefined();
    });
  });

  describe('path matching', () => {
    test('it matches an exact path', () => {
      const match = createMatcher({ path: '/api/user' });
      expect(match(new Request('http://test.io/api/user'))).toBeDefined();
      expect(match(new Request('http://test.io/api/'))).not.toBeDefined();
      expect(match(new Request('http://test.io/api/user/bob'))).not.toBeDefined();
    });

    test('it matches with path variables', () => {
      const match = createMatcher({ path: '/api/:entity' });
      expect(match(new Request('http://test.io/api/user'))).toBeDefined();
      expect(match(new Request('http://test.io/api/account'))).toBeDefined();

      expect(match(new Request('http://test.io/api/'))).not.toBeDefined();
      expect(match(new Request('http://test.io/api/account/profile'))).not.toBeDefined();
    });

    test('it matches with trailing wildcards', () => {
      const match = createMatcher({ path: '/api/account/*' });
      expect(match(new Request('http://test.io/api/account'))).toBeDefined();
      expect(match(new Request('http://test.io/api/account/profile'))).toBeDefined();

      expect(match(new Request('http://test.io/api/user'))).not.toBeDefined();
      expect(match(new Request('http://test.io/api/'))).not.toBeDefined();
    });

    test('returns matched variables', () => {
      const match = createMatcher({ path: '/api/:entity' });
      let v1 = match(new Request('http://test.io/api/user'));
      let v2 = match(new Request('http://test.io/api/account'));
      expect(v1?.params?.entity).toBe('user');
      expect(v2?.params?.entity).toBe('account');
    });
  });

  describe('protocol, host, and path matching', () => {
    test('it matches', () => {
      const match = createMatcher({ protocol: 'https', host: 'test.io', path: '/admin' });
      expect(match(new Request('https://test.io/admin'))).toEqual({ params: {} });
      expect(match(new Request('http://test.io/admin'))).not.toBeDefined();
      expect(match(new Request('https://sub.test.io/admin'))).not.toBeDefined();
      expect(match(new Request('https://test.io/admin/profile'))).not.toBeDefined();
    });

    test('it returns variables', () => {
      const match = createMatcher({ protocol: 'https', host: '*env.test.io', path: '/:acc/:entity' });
      expect(match(new Request('https://prod.test.io/admin/user'))).toEqual({
        params: {
          env: 'prod',
          acc: 'admin',
          entity: 'user'
        }
      });
      expect(match(new Request('https://dev.test.io/qa/mapping'))).toEqual({
        params: {
          env: 'dev',
          acc: 'qa',
          entity: 'mapping'
        }
      });
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
