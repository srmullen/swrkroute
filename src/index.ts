import type { MatcherConfig, Matcher, Context, Handler, MatchResult, Environment } from './types';
import { match, createMatcher } from './matchers';
import { rewrite } from './rewrite';

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
  Environment, // To be merged into context
  Handler
];

export default class Gateway {
  private config?: MatcherConfig;

  matchers: Array<GatewayMatcher>

  constructor() {
    // this.config = config;
    this.matchers = [];
  }

  match(matcher: Matcher, env: Environment, handler: Handler | Gateway) {
    if (handler instanceof Gateway) {
      // this.matchers.push([createMatcher(matcher), ctx, (req: Request, ctx: Context) => handler.handle(req, ctx)]);
      this.matchers.push([createMatcher(matcher), env, handler.handle.bind(handler)]);
    } else {
      this.matchers.push([createMatcher(matcher), env, handler]);
    }
  }

  async handle(req: Request, ctx: Context = {}): Promise<Response> {
    for (let matcher of this.matchers) {
      let matches = matcher[0](req);
      if (matches) {
        let handler = matcher[2];
        const params = { ...ctx.params, ...matches.params };
        const env = { ...ctx.env, ...matcher[1] };
        return handler(req, { ...ctx, params, env });
      }
    }
    return new Response('Not found', { status: 404 });
  }

  // async handle(req: Request) {
  //   let matches = match(req, this.config);
  //   let rw = req;
  //   if (matches && matches.target) {
  //     rw = rewrite(req, matches.target, matches.params);
  //   }
  //   const handler = matches?.res || ((request) => fetch(request));
  //   const res = await handler(rw);
  //   // TODO: Response rewriting
  //   return res;
  // }
}