export interface RewriteConfig {
  protocol?: string,
  host?: string,
  port?: string
}

export function rewriteHost(url: URL, host: string, params: Record<string, string> = {}): URL {
  for (let entry of Object.entries(params)) {
    host = host.replaceAll(`:${entry[0]}`, entry[1]);
  }

  url.host = host;
  return url;
}

// Should this allow users to use regex? Or just populate with params?
export function rewritePath() {

}

export function rewrite(req: Request, target: RewriteConfig, params: Record<string, string>) {
  // URL Rewriting
  let url = new URL(req.url);
  if (target.host) {
    url = rewriteHost(url, target.host, params);
  }

  // Header rewriting
  // TODO
  
  let rw = new Request(url.toString());
  return rw;
}