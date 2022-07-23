import type { Matcher } from './matchers';
import type { RewriteConfig } from './rewrite';
import { match } from './matchers';
import { rewrite } from './rewrite';

interface ProxyConfig {
  target?: RewriteConfig,
  match: Matcher[]
}

export function proxy(req: Request, config: ProxyConfig): Request | undefined {
  for (let matcher of config.match) {
    let matches = match(req, matcher);
    if (matches) {
      if (!config.target) {
        return req;
      }
      return rewrite(req, config.target, matches);
    }
  }
}