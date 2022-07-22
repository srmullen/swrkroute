type MatchOption = string | string[];

export interface Matcher {
  method?: MatchOption,
  protocol?: MatchOption,
  host?: string,
  path?: string,
}

export function hostToRegex(host: string): RegExp {
  let hostRE = host
    // $1 get replaced with the first group matched by the replace https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_string_as_a_parameter
    .replace(/:([a-zA-Z0-9]+)/g, '(?<$1>[a-zA-Z0-9]+)')
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

function matchMethod(reqMethod: string, option: MatchOption) {
  let matches = false;
  if (option === '*') {
    matches = true;
  } else {
    let methods = typeof option === 'string' ? [option] : option;
    matches = methods.some(method => method.toUpperCase() === reqMethod);
  }
  return matches;
}

function matchProtocol(url: URL, option: MatchOption) {
  let matches = false;
  if (option === '*') {
    matches = true;
  } else {
    let protocols = typeof option === 'string' ? [option] : option;
    // url.protocol leaves ':' on the protocol. i.e. `http:`
    matches = protocols.some(protocol => `${protocol}:` === url.protocol);
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

function matchPath(url: URL, option: string) {
  const re = pathToRegex(option);
  const match = url.pathname.match(re);
  if (match) {
    return match.groups || {};
  }
}

// This could return an object that contains information about the match.
export function match(req: Request, matcher: Matcher): Record<string, string> | undefined {
  const url = new URL(req.url);

  const matchers = [];
  
  if (matcher.method) {
    let method = matcher.method;
    matchers.push(() => matchMethod(req.method, method));
  }

  if (matcher.protocol) {
    let protocol = matcher.protocol;
    matchers.push(() => matchProtocol(url, protocol));
  }

  if (matcher.host) {
    let host = matcher.host;
    matchers.push(() => matchHost(url, host));
  }

  if (matcher.path) {
    let path = matcher.path;
    matchers.push(() => matchPath(url, path));
  }

  if (!matchers.length) {
    return;
  }

  let vars = {};
  let matches = true;
  for (let fn of matchers) {
    let match = fn();
    if (!match) {
      matches = false;
      break;
    }
    Object.assign(vars, match);
  }

  if (matches) {
    return vars;
  }
}
