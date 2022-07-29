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