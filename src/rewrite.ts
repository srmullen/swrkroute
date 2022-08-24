import type { Target } from './types';

export function createPathRewriter(rewriteConfig: Record<string, string>) {
  const rulesCache = parsePathRewriteRules(rewriteConfig);
  return rewritePath;

  function rewritePath(path: string) {
    let result = path;

    for (const rule of rulesCache) {
      if (rule.regex.test(path)) {
        result = result.replace(rule.regex, rule.value);
        break;
      }
    }

    return result;
  }
}

function parsePathRewriteRules(rewriteConfig: Record<string, string>) {
  let rules = [];

  for (const [key, value] of Object.entries(rewriteConfig)) {
    rules.push({
      regex: new RegExp(key),
      value: value
    });
  }

  return rules;
}

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
export function rewritePath(url: URL, rules: Record<string, string> | string, params: Record<string, string>) {
  let path;
  if (typeof rules === 'string') {
    path = rules;
  } else {
    const rewriter = createPathRewriter(rules);
    path = rewriter(url.pathname);
  }

  for (let entry of Object.entries(params)) {
    path = path.replaceAll(`:${entry[0]}`, entry[1]);
  }    

  url.pathname = path;

  return url;
}

export function rewriteHeaders(headers: Headers, rules: Record<string, string | null>, params: Record<string, string>) {
  let ret = new Headers(headers);
  for (let rule of Object.entries(rules)) {
    if (rule[1] === null) {
      ret.delete(rule[0]);
    } else {
      ret.set(rule[0], rule[1]);
    }
  }
  return ret;
}

async function createRequestBody(req: Request) {
  const contentType = req.headers.get('Content-Type');
  if (contentType?.includes('multipart/form-data')) {
    return await req.text()
  } else {
    return req.body;
  }
  // return req.body;
}

export async function rewrite(req: Request, target: Target, params: Record<string, string> = {}) {
  let url = new URL(req.url);

  if (target.protocol) {
    rewriteProtocol(url, target.protocol);
  }

  if (target.host) {
    rewriteHost(url, target.host, params);
  }

  if (target.port) {
    url.port = target.port;
  }

  if (target.path) {
    rewritePath(url, target.path, params);
  }

  const body = await createRequestBody(req);
  
  const headers = target.headers ? rewriteHeaders(req.headers, target.headers, params) : new Headers(req.headers);

  let rw = new Request(url.toString(), {
    method: target.method ?? req.method,
    headers,
    body: body
  });
  return rw;
}