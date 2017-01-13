# Outputcache

[![Version](https://img.shields.io/npm/v/outputcache.svg)](https://www.npmjs.com/package/outputcache)
[![License](https://img.shields.io/npm/l/outputcache.svg)](https://www.npmjs.com/package/outputcache)
[![Downloads](https://img.shields.io/npm/dt/outputcache.svg)](https://www.npmjs.com/package/outputcache)
[![Build Status](https://travis-ci.org/mpfdavis/outputcache.svg?branch=master)](https://travis-ci.org/mpfdavis/outputcache)
[![Test Coverage](https://coveralls.io/repos/mpfdavis/outputcache/badge.svg?branch=master&service=github)](https://coveralls.io/github/mpfdavis/outputcache?branch=master)

Seamlessly cache html, json or redirect responses using redis, memcached or any other cache provider for node.

## Why?

Caching data still exposes your application to processing overhead. Under heavy load, this can often severely impact throughput. 
You can significantly increase the performance and scalability of your applications by returning subsequent responses directly from cache.

## Installation

```bash
  npm install outputcache --save
```

- Fast - returns original response directly from cache and uses optimised version of LRU cache by default (Maps)
- Simple - honours all original headers, status codes and requires few code changes
- Flexible - use any cache provider under the hood - in-process or remote such as redis cache
- Well tested - many unit tests and used in production by major e-commerce business

## Initialize

```js
const OutputCache = require('outputcache');
const xoc = new OutputCache({ varyByQuery: ['page', 'sort'] });
```

### Options

- `ttl`: *(default: `600`)* the standard ttl as number in seconds for each cache item  
- `maxItems`: *(default: `1000`)* the number of items allowed in the cache before older, unused items are pushed out - this can be set much higher for 'out of process' caches such as redis
- `useCacheHeader`: *(default: `true`)* use the max-age cache header from the original response as ttl by default. If you set this to false the options.ttl or default is used instead
- `varyByQuery`: *(default: `[]`)* accepts a boolean or array - true/false to use all/ignore all or array to use only specific querystring arguments in the cache key
- `varyByCookies`: *(default: `[]`)* accepts an array of cookie names - the cache key will include the value of the named cookie if found in the request
- `allowSkip` *(default: true)* 
- `skip3xx`: *(default: false)* never cache 3xx responses
- `skip4xx`: *(default: false)* never cache 4xx responses
- `skip5xx`: *(default: false)* never cache 5xx responses
- `noHeaders`: *(default: false)* do not add X-Output-Cache headers to the response - useful for security if you wish to hide server technologies
- `staleWhileRevalidate`: *(default: 0)* the default cache provider supports the stale-while-revalidate ttl from the header or will use this setting if useCacheHeader is false
- `cacheProvider`: *(default: object)* object exposing the default cache and its interface - see below for override settings

**Note:** varyByCookies requires you to register a cookie parser such as the 'cookie-parser' module in your application before Outputcache.

## Usage

- Can be used as a route or global middleware - see examples below. 
- Should be placed as early as possible in the response lifecycle to maximise performance.

## Example

The following example places Outputcache before "api.middleware" - this ensures all cached responses return as soon as possible and avoid any subsequent data gathering or processing.

```js

const OutputCache = require('outputcache');
const xoc = new OutputCache();

app.get('/', xoc.middleware, api.middleware, (req, res) => {
  
  const data = {hello:'world'};      
  res.render('hello', data);
  
});

app.get('/api/:channel', xoc.middleware, api.middleware, (req, res) => {
 
  const data = {hello:'world'};     
  res.json(data);
  
});

```

## Using an alternative cache provider

Outputcache supports any cache provider by exposing the cache and get/set methods on its own 'cacheProvider' property. The examples below show how redis can be used. 
The only requirement is that your cache returns a promise - if it doesn't, one way to handle this is overriding the get method to wrap the callback in a promise.

```js
const xoc = require('outputcache');
const redis = require('redis');
const client = redis.createClient();

const xoc = new OutputCache({
    cacheProvider: {
        cache: client,
        get: key => {
            return new Promise(resolve => {
                xoc.cacheProvider.cache.get(key, function (err, result) {
                    if(err || !result) {
                        return resolve(null);
                    }
                    return resolve(result);
                });
            });
        },
        set: (key, item, ttl) => {
            xoc.cacheProvider.cache.set(key, JSON.stringify(item));
            xoc.cacheProvider.cache.expire(key, ttl);
        }
    }
});

```

## Logging

Passing an instance of a logger to outputcache is no longer supported - hits, misses or cache errors can be logged by listening for events (see below) on the outputcache instance. This gives the developer greater control over the logging format etc.

## Headers

- Will add 'x-output-cache ms/ht ttl swr' to the response headers to indicate a miss/hit the ttl of the response in cache and the value of the staleWhileRevalidate in cache if in use
- Will honour all headers assigned to the original response, including for redirects
- The x-output-cache header can be disabled by setting noHeaders to true

## Force cache skip

It may be useful to skip outputcache completely for specific requests, you can force a cache skip (miss) when the allowSkip option is true (default) and:

- The querystring collection contains 'cache=false' value pair.
- The request has an 'x-output-cache' header set with the value 'ms'
- The request has an x-output-cache cookie with value 'ms'

This behaviour can be disabled by setting allowSkip to false

## Methods

```js
const xoc = new OutputCache();

xoc.middleware => // (req, res, next)
```

## Events

```js
const xoc = new OutputCache();

xoc.on('hit', cacheItem => {

});

xoc.on('miss', info => {

});

xoc.on('cacheProviderError', err => {

});
```

## Performance

Outputcache has more impact on your application performance the more it gets hit - you can help to ensure more cache hits by making cache keys as simple as possible e.g. disable querystring or cookie based caching or only allow specific querystring args to be used as keys

The follow snapshots show the inverse relationship between response latency and requests when using outputcache and achieving a high volume of hits

![Requests](https://www.dropbox.com/s/of1d38r9l3yx4km/Screen%20Shot%202017-01-13%20at%2015.26.30.png?dl=0)
![Latency](https://www.dropbox.com/s/prxts69zp1obcel/Screen%20Shot%202017-01-13%20at%2015.26.55.png?dl=0)