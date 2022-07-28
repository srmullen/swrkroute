export type MatchOption = string | string[];

export interface Target {
  protocol?: string,
  host?: string,
  port?: string,
  path?: string,
};

export interface Matcher {
  method?: MatchOption,
  protocol?: MatchOption,
  host?: string,
  path?: string,

  target?: Target,
  match?: Matcher[],
}

export interface RewriteConfig {
  target?: Target,
  params?: Record<string, string>,
}