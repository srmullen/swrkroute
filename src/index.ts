import type { Matcher, Context, Handler, GatewayMatcher, Environment } from './types';
import { createMatcher } from './matchers';

export { rewrite } from './rewrite';

export function connect(...args: Handler[]): Handler {
  if (args.length === 1) {
    return args[0];
  }
  const [fn, ...rest] = args;
  return (req: Request, ctx: Context) => {
    return fn(req, ctx, connect(...rest));
  }
}

export class Gateway {
  matchers: Array<GatewayMatcher>;
  env: Environment;

  constructor(env: Environment = {}) {
    this.matchers = [];
    this.env = env;
  }

  match(matcher: Matcher, handler: Handler | Gateway) {
    if (handler instanceof Gateway) {
      this.matchers.push([createMatcher(matcher), handler.handle.bind(handler)]);
    } else {
      this.matchers.push([createMatcher(matcher), handler]);
    }
  }

  async handle(req: Request, ctx: Context = {}): Promise<Response> {
    for (let matcher of this.matchers) {
      let matches = matcher[0](req);
      if (matches) {
        let handler = matcher[1];
        const params = { ...ctx.params, ...matches.params };
        // const env = { ...this.env, ...matcher[1] };
        const env = { ...ctx.env, ...this.env };
        return handler(req, { ...ctx, params, env });
      }
    }
    return new Response('Not found', { status: 404 });
  }
}