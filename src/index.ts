import type { Matcher } from './types';
import { match } from './matchers';
import { rewrite } from './rewrite';

export function proxy(req: Request, config: Matcher): Request | undefined {
  let matches = match(req, config);
  if (matches) {
    if (!matches.target) {
      return req;
    }
    return rewrite(req, matches.target, matches.params);
  }
}

export default class Gateway {
  private config: Matcher;

  constructor(config: Matcher) {
    this.config = config;
  }

  async handle(req: Request) {
    let matches = match(req, this.config);
    let rw = req;
    if (matches && matches.target) {
      rw = rewrite(req, matches.target, matches.params);
    }
    const res = await fetch(rw);
    // TODO: Response rewriting
    return res;
  }
}