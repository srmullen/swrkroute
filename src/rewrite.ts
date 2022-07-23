interface RewriteConfig {
  host: string;
}

export function rewriteHost(url: URL, config: any, params: Record<string, string> = {}): URL {
  let host = config.host;
  for (let entry of Object.entries(params)) {
    host = host.replaceAll(`:${entry[0]}`, entry[1]);
  }

  url.host = host;
  return url;
}

// Should this allow users to use regex? Or just populate with params?
export function rewritePath() {

}