import type { Matcher } from './matchers';
import { match } from './matchers';

interface ProxyConfig {
  target?: {
    protocol?: string,
    host?: string,
    port?: string
  },
  match: Matcher[]
}

export function proxy(req: Request, config: ProxyConfig): Request | undefined {
  // let url = new URL(req.url);
  for (let matcher of config.match) {
    let matches = match(req, matcher);
    if (matches) {
      return req;
    }
  }
}