import { describe, test, expect, vi } from 'vitest';
import { Gateway, rewrite, connect } from './';
import type { Context, Handler } from './types';

function responsdWithContext(req: Request, ctx: Context) {
  return new Response(JSON.stringify(ctx));
}

const rwMiddleware = (target: Record<string, string>): Handler => (req, ctx, next) => {
  const rw = rewrite(req, target, ctx.params);
  return next(rw, ctx);
}

describe('connect', () => {
  test('it calls the function', async () => {
    const fn = vi.fn();
    const handler = connect(fn);
    let req = new Request('http://test.io');
    let ctx = {};
    await handler(req, ctx);
    expect(fn).toHaveBeenCalledWith(req, ctx);
  });

  test('it calls multiple functions', async () => {
    let fn1: Handler = (req, ctx, next) => {
      return next(req, ctx);
    }
    let fn2: Handler = (req, ctx) => {
      return new Response('Success');
    }
    const handler = connect(fn1, fn2);
    const res = await handler(new Request('http://test.io'), {});
    expect(await res.text()).toBe('Success');
  });

  test('it passes along request and context', async () => {
    let fn1: Handler = (req, ctx, next) => {
      return next(rewrite(req, { protocol: 'https', host: 'changed.io' }), { params: { hello: 'world' } });
    }
    let fn2: Handler = (req, ctx) => {
      return new Response(JSON.stringify({
        url: req.url,
        ctx
      }));
    }
    const handler = connect(fn1, fn2);
    const res = await handler(new Request('http://test.io'), {});
    const json = await res.json();
    expect(json.url).toBe('https://changed.io/');
    expect(json.ctx).toEqual({ params: { hello: 'world' } });
  });
});

describe('proxy', () => {
  // Is this how it should work? What is the best behavior here?
  test('Returns undefined if there is no match', async () => {
    const req = new Request('http://localhost:3010/test');
    const gateway = new Gateway();
    const res = await gateway.handle(req);
    expect(res.status).toBe(404);
  });

  describe('host matching', () => {
    test('successful match', async () => {
      const gateway = new Gateway();
      gateway.match({ protocol: 'http', host: 'localhost:3010' }, (req, ctx) => {
        return new Response(req.url);
      });
      const req = new Request('http://localhost:3010/test');
      const res = await gateway.handle(req);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('http://localhost:3010/test');
    });

    test('failure to match', async () => {
      const gateway = new Gateway();
      const router = new Gateway();
      gateway.match({ host: '127.0.0.1:5432' }, router);
      router.match({ path: '/test' }, (req, ctx) => {
        return new Response('hello');
      });
      
      const req = new Request('http://localhost:3010/test');
      const res = await gateway.handle(req);
      expect(res.status).toBe(404);
    });

    test('wildcard host', async () => {
      const gateway = new Gateway();
      gateway.match({ host: '*.example.com' }, responsdWithContext);
      const r1 = await gateway.handle(new Request('http://example.com'));
      const r2 = await gateway.handle(new Request('http://subdomain.example.com'))
      expect(r1.status).toBe(404);
      expect(r2.status).toBe(200);
    });

    test('it rewrites the host', async () => {
      const gateway = new Gateway({ target: {
        host: 'api.example.com'
      }});
      const rwMiddleware: Handler = (req, ctx, next) => {
        const rw = rewrite(req, ctx.env.target, ctx.params);
        return next(rw, ctx);
      }
      gateway.match({ host: 'example.com' }, connect(rwMiddleware, (req, ctx) => {
        return new Response(JSON.stringify({
          url: req.url
        }))
      }));

      const res = await gateway.handle(new Request('http://example.com'))
      expect(await res.json()).toEqual({ url: 'http://api.example.com/' });
    });
  });

  describe('nested rewriting', () => {
    test('it rewrites with the nested target', async () => {
      const gateway = new Gateway();
      const nested = new Gateway();
      gateway.match({ protocol: 'http' }, nested);
      nested.match({}, connect(rwMiddleware({ protocol: 'https', host: 'localhost:8787' }), (req, ctx) => {
        return new Response(JSON.stringify({ url: req.url }));
      }));
      const res = await gateway.handle(new Request('http://api.worker.io'));
      expect(await res.json()).toEqual({ url: 'https://localhost:8787/' });
    });
  });

  describe('Use as a router', () => {
    test('it rewrites requests to /api to the api host', async () => {
      const gateway = new Gateway();
      gateway.match(
        { method: ['GET', 'POST', 'PUT', 'DELETE'], path: '/api' }, 
        connect(
          rwMiddleware({ protocol: 'https', host: 'api.example.com', path: '/' }),
          (req, ctx) => {
            return new Response(JSON.stringify({ url: req.url }));
          }
        ));
      // const r1 = proxy(new Request('http://test.io/api'), config);
      const res = await gateway.handle(new Request('http://test.io/api'));
      expect(await res.json()).toEqual({ url: 'https://api.example.com/' });
    });
  });
});

describe('Gateway', () => {
  describe('res handlers', () => {
    describe('procedural setup', () => {
      test('adding a matcher', () => {
        const gateway = new Gateway();
        const handler = vi.fn();
        gateway.match({ host: 'localhost:8787' }, handler);
        gateway.handle(new Request('http://test.io'));
        expect(handler).not.toHaveBeenCalled();
        gateway.handle(new Request('http://localhost:8787'));
        expect(handler).toHaveBeenCalled();
      });

      test('nested matchers', () => {
        const handler = vi.fn();
        const gateway = new Gateway();
        const localhost = new Gateway();
        localhost.match({ path: '/api' }, handler);
        gateway.match({ host: 'localhost:8787' }, localhost);
        gateway.handle(new Request('http://localhost:8787'));
        gateway.handle(new Request('http://127.0.0.1:8787/api'));
        expect(handler).not.toHaveBeenCalled();
        gateway.handle(new Request('http://localhost:8787/api'));
        expect(handler).toHaveBeenCalled();
      });

      test('it does not continue matching higher lever routes if it fails to match nested route', async () => {
        const userHandle = vi.fn();
        const accountHandle = vi.fn();
        const api = new Gateway();
        api.match({ path: '/user' }, userHandle);

        const admin = new Gateway();
        admin.match({ path: '/account' }, accountHandle);

        const apiSpy = vi.spyOn(api, 'handle');
        const adminSpy = vi.spyOn(admin, 'handle');

        const gateway = new Gateway();
        gateway.match({ host: 'admin.test.io' }, admin);
        gateway.match({ host: '*.test.io' }, api);
        // gateway.match({ host: 'admin.test.io' }, {}, admin);

        // This matches both hosts but only the api endpoint. Because the admin host is listed first it does not continue to try to match the wildcard host.
        const res = await gateway.handle(new Request('http://admin.test.io/user'));
        expect(res.status).toBe(404);
        expect(userHandle).not.toHaveBeenCalled();
        expect(accountHandle).not.toHaveBeenCalled();
        expect(adminSpy).toHaveBeenCalled();
        expect(apiSpy).not.toHaveBeenCalled();

        await gateway.handle(new Request('http://api.test.io/user'));
        expect(userHandle).toHaveBeenCalled();
        expect(accountHandle).not.toHaveBeenCalled();
        expect(adminSpy).toHaveBeenCalled();
        expect(apiSpy).toHaveBeenCalled();
      });

      test('handler does not need to be async', async () => {
        const gateway = new Gateway();
        gateway.match({ path: '/sync' }, () => new Response('Hello'));
        gateway.match({ path: '/async' }, async () => new Response('async'));
        const res = await gateway.handle(new Request('http://localhost:8080/sync'));
        expect(await res.text()).toBe('Hello');
        const ares = await gateway.handle(new Request('http://localhost:8080/async'));
        expect(await ares.text()).toBe('async');
      });
    });

    describe('context', () => {
      describe('params', () => {
        test('params are included', async () => {
          const gateway = new Gateway();
          gateway.match({ path: '/:greeting/:place' }, (req, ctx) => {
            return new Response(`${ctx.params.greeting}, ${ctx.params.place}`);
          });
  
          const res = await gateway.handle(new Request('http://test.io/hello/world'));
          expect(await res.text()).toBe('hello, world');
        });
  
        test('nested matchers include params from parent matchers', async () => {
          const gateway = new Gateway();
          const subdomain = new Gateway();
          subdomain.match({ host: '*sub.test.io' }, async (req, ctx) => {
            return new Response(`${ctx.params.sub} ${ctx.params.entity}`);
          });
          gateway.match({ path: '/:entity' }, subdomain);
  
          const res = await gateway.handle(new Request('http://api.test.io/account'));
          expect(await res.text()).toBe('api account');
        });
      });

      describe('env', () => {
        test('the env object is merged', async () => {
          const gateway = new Gateway({ target: { hello: 'world' } });
          gateway.match({ host: 'localhost:3000' }, async (req, ctx) => {
            return new Response(JSON.stringify(ctx.env));
          });
          const res = await gateway.handle(new Request('http://localhost:3000'));
          expect(await res.json()).toEqual({ target: { hello: 'world' } });
        });
      });
    });
  });
});