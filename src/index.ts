import type { MatcherConfig, Matcher, Context, Handler, MatchResult, Environment } from './types';
import { match, createMatcher } from './matchers';
import { rewrite } from './rewrite';

export { rewrite } from './rewrite';

export function proxy(req: Request, config: MatcherConfig): Request | undefined {
  let matches = match(req, config);
  if (matches) {
    if (!matches.target) {
      return req;
    }
    return rewrite(req, matches.target, matches.params);
  }
}

type GatewayMatcher = [
  (req: Request) => MatchResult | undefined, // Matching function
  Handler
];

export default class Gateway {
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
        const env = { ...this.env, ...matcher[1] };
        return handler(req, { ...ctx, params, env });
      }
    }
    return new Response('Not found', { status: 404 });
  }
}