# outputcache

[![Version](https://img.shields.io/npm/v/outputcache.svg)](https://www.npmjs.com/package/outputcache)
[![License](https://img.shields.io/npm/l/outputcache.svg)](https://www.npmjs.com/package/outputcache)
[![Build Status](https://travis-ci.org/mpfdavis/outputcache.svg?branch=master)](https://travis-ci.org/mpfdavis/outputcache)

Simple to use, load-tested, outputcache for node - supports caching the response of **res.send, res.render, res.json**, **res.redirect** and all headers

## Install

```bash
  npm install outputcache
```

This module will wrap any route returning json or html and seamlessly cache the output, status and headers for future responses, preventing continous re-rendering or other expensive operations that will inhibit performance under load.

## Why?

Under heavy load, Node applications can suffer poor performance even if they make use of cached data.

- Fast, returns raw response and optimises hit-ratio by discarding least recently used items first
- Simple, honours cache-control and requires little code changes

## Initialize

```js
var OutputCache = require('outputcache');
var cache = new OutputCache({ varyByQuery: true, logger: winston, varyByCookies: ['country'] });
```

### Options

- `ttl`: *(default: `600`)* the standard ttl as number in seconds for each cache item  
- `maxItems`: *(default: `1000`)* the number of items allowed in the cache before older, unused items are pushed out
- `useCacheHeader`: *(default: `true`)* use the max-age cache header from the original response as ttl 
- `varyByQuery`: *(default: `false`)* cache key will use the request path by default, setting this to true will include the querystring for more complex cache keys
- `varyByCookies`: *(default: `[]`)* accepts an array of cookie names - the cache key will include the value of the named cookie if found in the request
- `logger`: *(default: null)* pass in an instance of your chosen logger for logging info - expects an info property/function to be available i.e. logger.info(... 

**Note:** varyByCookies requires you to register a cookie parser such as the popular 'cookie-parser' module in your application before outputcache. Express no longer does this by default.

## Usage

- Place in route or middleware

Will cache response for res.send, res.render, res.json or res.redirect methods

Can be used as a route or global middleware. Order of execution is important. The following example places the outputcache before 'dataMiddleware' - this ensures all cached responses return as soon as possible and avoid subsequent data gathering or processing.

```js

var OutputCache = require('outputcache');
var cache = new OutputCache({logger: winston, varyByCookies: ['country'] });

app.get('/', cache.middleware, dataMiddleware,  function (req, res) {
  
  var someData = res.locals.data.hello;      
  res.render('helloworld', someData);
  
});

app.get('/api/:channel', cache.middleware, dataMiddleware,  function (req, res) {
  
  var someData = res.locals.data.hello;      
  res.json(someData);
  
});

```

## Headers

- Will add 'X-Output-Cache' to the response headers with a ms (miss) or ht (hit) value
- Will honour headers and status codes assigned to the original response, including for redirects

## Cache skip

A cache skip (miss) will occur for all requests when:

- If the querystring collection contains 'cache=false' value pair.
- The request has an 'X-Output-Cache' header set with the value 'ms'

## What's new?

- No longer checks the process and will cache output for all NODE_ENV - checking process is an expensive operation so this is now avoided. If you don't want to use outputcache in dev mode, it's easy enough to manage this outside of the module
- Now uses stale-lru-cache - this uses Maps for storage and is many, many times faster than Objects. The popular 'lru-cache' was found to leak memory and become slow under heavy load
- useCacheHeader now defaults to true - the module will seek to use cache-control max-age for ttl unless this is set to false

## Coming Soon
- Option to skip 4xx, 3xx, 5xx
- Option varyByUserAgent
- Option to use any cache provider e.g. memcache
- Log misses
- Cache skip via cookie