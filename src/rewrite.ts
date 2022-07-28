import type { Target } from './types';

export function rewriteProtocol(url: URL, protocol: string) {
  url.protocol = protocol;
}

export function rewriteHost(url: URL, host: string, params: Record<string, string> = {}) {
  for (let entry of Object.entries(params)) {
    host = host.replaceAll(`:${entry[0]}`, entry[1]);
  }

  url.host = host;
}

// Should this allow users to use regex? Or just populate with params?
export function rewritePath(url: URL, path: string) {

}

export function rewrite(req: Request, target: Target, params: Record<string, string> = {}) {
  // URL Rewriting
  let url = new URL(req.url);

  if (target.protocol) {
    rewriteProtocol(url, target.protocol);
  }

  if (target.host) {
    rewriteHost(url, target.host, params);
  }

  if (target.path) {
    rewritePath(url, target.path);
  }

  // Header rewriting
  // TODO

  let rw = new Request(url.toString());
  return rw;
}