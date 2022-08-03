import { describe, test, expect, vi } from 'vitest';
import Gateway, { proxy  } from './';

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

describe('Gateway', () => {
  describe('res handlers', () => {
    // test('it calls the handler', async () => {
    //   const handler = vi.fn();
    //   const gateway = new Gateway({
    //     res: handler
    //   });
    //   await gateway.handle(new Request('http://localhost:8787'));
    //   expect(handler).toHaveBeenCalled();
    // });
  
    // test.skip('nested handlers take precendence', async () => {
    //   const h1 = vi.fn();
    //   const h2 = vi.fn();
    //   const gateway = new Gateway({
    //     res: h1,
    //     match: [
    //       { path: '/api', res: h2 }
    //     ]
    //   });

    //   await gateway.handle(new Request('http://localhost:8787'));
    //   expect(h1).toHaveBeenCalledOnce();
    //   expect(h2).not.toHaveBeenCalled();
    //   await gateway.handle(new Request('http://localhost:8787/api'));
    //   expect(h1).toHaveBeenCalledOnce();
    //   expect(h2).toHaveBeenCalledOnce();
    // });

    describe('procedural setup', () => {
      test('adding a matcher', () => {
        const gateway = new Gateway();
        const handler = vi.fn();
        gateway.match({ host: 'localhost:8787' }, {}, handler);
        gateway.handle(new Request('http://test.io'));
        expect(handler).not.toHaveBeenCalled();
        gateway.handle(new Request('http://localhost:8787'));
        expect(handler).toHaveBeenCalled();
      });

      test('nested matchers', () => {
        const handler = vi.fn();
        const gateway = new Gateway();
        const localhost = new Gateway();
        localhost.match({ path: '/api' }, {}, handler);
        gateway.match({ host: 'localhost:8787' }, {}, localhost);
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
        api.match({ path: '/user' }, {}, userHandle);

        const admin = new Gateway();
        admin.match({ path: '/account' }, {}, accountHandle);

        const apiSpy = vi.spyOn(api, 'handle');
        const adminSpy = vi.spyOn(admin, 'handle');

        const gateway = new Gateway();
        gateway.match({ host: 'admin.test.io' }, {}, admin);
        gateway.match({ host: '*.test.io' }, {}, api);
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
        gateway.match({ path: '/sync' }, {}, () => new Response('Hello'));
        gateway.match({ path: '/async' }, {}, async () => new Response('async'));
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
          gateway.match({ path: '/:greeting/:place' }, {}, (req, ctx) => {
            return new Response(`${ctx.params.greeting}, ${ctx.params.place}`);
          });
  
          const res = await gateway.handle(new Request('http://test.io/hello/world'));
          expect(await res.text()).toBe('hello, world');
        });
  
        test('nested matchers include params from parent matchers', async () => {
          const gateway = new Gateway();
          const subdomain = new Gateway();
          subdomain.match({ host: '*sub.test.io' }, {}, async (req, ctx) => {
            return new Response(`${ctx.params.sub} ${ctx.params.entity}`);
          })
          gateway.match({ path: '/:entity' }, {}, subdomain);
  
          const res = await gateway.handle(new Request('http://api.test.io/account'));
          expect(await res.text()).toBe('api account');
        });
      });

      describe('env', () => {
        test('the env object is merged', async () => {
          const gateway = new Gateway();
          gateway.match({ host: 'localhost:3000' }, { target: { hello: 'world' } }, async (req, ctx) => {
            return new Response(JSON.stringify(ctx.env));
          });
          const res = await gateway.handle(new Request('http://localhost:3000'));
          expect(await res.json()).toEqual({ target: { hello: 'world' } });
        });
      });
    });

    // describe('middleware', () => {
    //   const gateway = new Gateway();
    //   const logSubdomain = (req, ctx, next) => {
    //     console.log(`Subdomain: ${ctx.params.sub}`);
    //     return next(req, ctx);
    //   };
    //   gateway.match({ host: '*sub.test.io' }, {}, logSubdomain, (req, ctx) => {
    //     return new Response('Hello');
    //   });
    // });
  });

  // describe('api ideation', () => {
  //   test('connect middleware style', () => {
  //     const gateway = new Gateway();
  //     const local = gateway.host('http://localhost:8787');
  //     // I would prefer the middleware not to have to handle the next function. It should return a 
  //     // response or carry on to the next middleware/handler.
  //     // I also would rather not have the res as part of the middleware. I don't like
  //     // to have the response available before a request has even been made.
  //     local.get('/user', (req, res, next) => new Response('Success', { status: 200 }));
  //     local.post('/user', (req, res, next) => new Response('success', { status: 201 }));

  //     const api = gateway.host('http://api.localhost:8787');
  //     // How to specify request vs. response rewriting
  //     const api.all(rewrite({ host: 'localhost:8787', path: { '^/': '/api'}}))
  //   });

  //   test('new style', () => {
  //     const gateway = new Gateway();
  //     const local = gateway.host('http://localhost:8787');
  //     local.get('/user', (req, ctx, next) => new Response('Success', { status: 200 }));
  //     local.post('/user', (req, ctx, next) => new Response('success', { status: 201 }));
      
  //     const api = gateway.host('http://api.localhost:8787');
  //     // How to specify request vs. response rewriting
  //     const logger = (req, ctx, next) => {
  //       console.log(req.url);
  //       // Cant do connect style middleware without mutable request object. Require req passed to next.
  //       const res = await next(req);
  //       console.log(res.status);
  //       return res;
  //     };
  //     const api.all(
  //       rewrite({ host: 'localhost:8787', path: { '^/': '/api'}}), 
  //       logger,
  //       fetch // Could fetch be automatic if there are no calls after next
  //     );
  //   });
  // });

  // test('procedural match', () => {
  //   const gateway = new Gateway();
  //   const local = gateway.match({ protocol: 'http', host: 'localhost:8787' });
  //   local.match({ mathod: 'GET', path: '/user'}, (req, ctx, next) => new Response('Success', { status: 200 }));
  //   local.match({ method: 'POST', path: '/user'}, (req, ctx, next) => new Response('success', { status: 201 }));
    
  //   const api = gateway.match({ host: 'api.localhost:8787' });
  //   // How to specify request vs. response rewriting
  //   const logger = (req, ctx, next) => {
  //     console.log(req.url);
  //     // Cant do connect style middleware without mutable request object. Require req passed to next.
  //     const res = await next(req);
  //     console.log(res.status);
  //     return res;
  //   };
  //   const api.match(
  //     { method: '*' },
  //     rewrite({ host: 'localhost:8787', path: { '^/': '/api'}}), 
  //     logger,
  //     fetch // Could fetch be automatic if there are no calls after next
  //   );
  // });
});