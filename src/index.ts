import type { Matcher } from './matchers';

interface ProxyConfig {
  match: Matcher[]
}

export function proxy(req: Request, config: ProxyConfig): Request | undefined {
  let url = new URL(req.url);
  for (let match of config.match) {
    // const url = new URL(match.url);
    if (match.host === url.host) {
      return req;
    }
  }
}