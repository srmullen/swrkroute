import type { MatchOption, MatcherConfig, MatchResult } from './types';

export function hostToRegex(host: string): RegExp {
  let hostRE = host
    // $1 get replaced with the first group matched by the replace https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_string_as_a_parameter
    .replace(/\*\./g, '(?:[a-zA-Z0-9\-]+)\.')              // wildcard (non-capturing group)
    .replace(/\*([a-zA-Z0-9]+)/g, '(?<$1>[a-zA-Z0-9\-]+)') // named wildcard (named group)
    .replace(/\./g, '\\.');
  let str = `^${hostRE}$`;
  // console.log(str);
  return RegExp(str);
}

export function pathToRegex(path: string) {
  const pathRE = path
    .replace(/(\/?)\*/g, '($1.*)?')                             // trailing wildcard
    .replace(/\/$/, '')                                         // remove trailing slash
    .replace(/:(\w+)(\?)?(\.)?/g, '$2(?<$1>[^/]+)$2$3')         // named params
    .replace(/\.(?=[\w(])/, '\\.')                              // dot in path
    .replace(/\)\.\?\(([^\[]+)\[\^/g, '?)\\.?($1(?<=\\.)[^\\.') // optional image format
  
  return RegExp(`^${pathRE}$`);
}

function matchMethod(reqMethod: string, option: MatchOption): Record<string, string> | undefined {
  let matches;
  if (option === '*') {
    matches = {};
  } else {
    let methods = typeof option === 'string' ? [option] : option;
    matches = methods.some(method => method.toUpperCase() === reqMethod) ? {} : undefined;
  }
  return matches;
}

function matchProtocol(url: URL, option: MatchOption): Record<string, string> | undefined {
  let matches;
  if (option === '*') {
    matches = {};
  } else {
    let protocols = typeof option === 'string' ? [option] : option;
    // url.protocol leaves ':' on the protocol. i.e. `http:`
    matches = protocols.some(protocol => `${protocol}:` === url.protocol) ? {} : undefined;
  }
  return matches;
}

function matchHost(url: URL, option: string) {
  const re = hostToRegex(option);
  const match = url.host.match(re);
  if (match) {
    return match.groups || {};
  }
}

function matchPort(url: URL, option: string) {
  return url.port === option ? {} : undefined;
}

function matchPath(url: URL, option: string) {
  const re = pathToRegex(option);
  const match = url.pathname.match(re);
  if (match) {
    return match.groups || {};
  }
}

export function createMatcher(config: MatcherConfig) {
  const matchers: ((m: Request, u: URL) => Record<string, string> | undefined)[] = [];
  if (config.method) {
    let method = config.method;
    matchers.push((req: Request, _url: URL) => matchMethod(req.method, method));
  }

  if (config.protocol) {
    let protocol = config.protocol;
    matchers.push((_req: Request, url: URL) => matchProtocol(url, protocol));
  }

  if (config.host) {
    let host = config.host;
    matchers.push((_req: Request, url: URL) => matchHost(url, host));
  }

  if (config.port) {
    let port = config.port;
    matchers.push((_req: Request, url: URL) => matchPort(url, port));
  }

  if (config.path) {
    let path = config.path;
    matchers.push((_req: Request, url: URL) => matchPath(url, path));
  }

  return (req: Request): MatchResult | undefined => {
    let url = new URL(req.url);
    let params = {};
    let matches = true;
    for (let fn of matchers) {
      let match = fn(req, url);
      if (!match) {
        matches = false;
        break;
      }
      Object.assign(params, match);
    }
    if (matches) {
      return { params };
    }
  }
}