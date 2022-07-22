import { describe, test, expect } from 'vitest';

describe('regex', () => {
  // RE to match url and separate into groups
  let re = /^([A-Za-z]+):\/\/([0-9A-Za-z\.]+(?::[0-9]+)?)(\/[A-Za-z0-9]+(?:\/[A-Za-z0-9]+)*)?/;
  test('global regex: it matches protocol', () => {
    let url = 'http://localhost:8080';
    let re = /^([A-Za-z]+):\/\//g;
    let res = url.matchAll(re);
    expect(res).toBeDefined();
    let matches = [...res];
    expect(matches.length).toBe(1);
    // First capture group
    expect(matches[0][1]).toBe('http');
  });

  test('it matches protocol', () => {
    let url = 'http://localhost:8080';
    let res = url.match(re);
    expect(res).toBeDefined();
    expect(res?.[1]).toBe('http');
  });

  test('it matches protocol', () => {
    let url = 'ftp://localhost:8080';
    let res = url.match(re);
    expect(res).toBeDefined();
    expect(res?.[1]).toBe('ftp');
  });

  test('it matches host', () => {
    let url = 'http://localhost';
    let res = url.match(re);
    expect(res).toBeDefined();
    expect(res?.[1]).toBe('http');
    expect(res?.[2]).toBe('localhost');
  });

  test('it matches host', () => {
    let url = 'https://127.0.0.1';
    let res = url.match(re);
    expect(res).toBeDefined();
    expect(res?.[1]).toBe('https');
    expect(res?.[2]).toBe('127.0.0.1');
  });

  test('it matches host and port', () => {
    let url = 'http://localhost:3000';
    let res = url.match(re);
    expect(res).toBeDefined();
    expect(res?.[1]).toBe('http');
    expect(res?.[2]).toBe('localhost:3000');
  });

  test('it matches host and port', () => {
    let url = 'http://127.0.0.1:123456';
    let res = url.match(re);
    expect(res).toBeDefined();
    expect(res?.[1]).toBe('http');
    expect(res?.[2]).toBe('127.0.0.1:123456');
  });

  test('it matches paths', () => {
    let url = 'http://localhost:4321/hello';
    let res = url.match(re);
    expect(res?.[1]).toBe('http');
    expect(res?.[2]).toBe('localhost:4321');
    expect(res?.[3]).toBe('/hello');
  });

  test('it matches paths', () => {
    let url = 'http://127.0.0.1/hello/world';
    let res = url.match(re);
    expect(res?.[1]).toBe('http');
    expect(res?.[2]).toBe('127.0.0.1');
    expect(res?.[3]).toBe('/hello/world');
  });
});