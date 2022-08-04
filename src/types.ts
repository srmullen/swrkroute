export type MatchOption = string | string[];

type RequestHandler = (req: Request) => Response;

// export type Context = Record<string, any>;
export type Context = {
  params?: Record<string, string>,
  env?: Environment,
}

export type Environment = Record<string, any>

export type Handler = (req: Request, ctx: Context, next?: Handler) => Promise<Response> | Response;

export interface Target {
  protocol?: string,
  host?: string,
  port?: string,
  path?: Record<string, string> | string,
  method?: string,
  headers?: Record<string, string>,
};

export interface Matcher {
  method?: MatchOption,
  protocol?: MatchOption,
  host?: string,
  path?: string,
}

export interface MatcherConfig extends Matcher {
  target?: Target,
  match?: MatcherConfig[],
  res?: RequestHandler
}

export interface RewriteConfig {
  target?: Target,
  params?: Record<string, string>,
}

export interface MatchResult extends RewriteConfig {
  res?: RequestHandler
}

export type GatewayMatcher = [
  (req: Request) => MatchResult | undefined, // Matching function
  Handler
];