# Outputcache

[![Version](https://img.shields.io/npm/v/outputcache.svg)](https://www.npmjs.com/package/outputcache)
[![License](https://img.shields.io/npm/l/outputcache.svg)](https://www.npmjs.com/package/outputcache)
[![Downloads](https://img.shields.io/npm/dt/outputcache.svg)](https://www.npmjs.com/package/outputcache)
[![Build Status](https://travis-ci.org/mpfdavis/outputcache.svg?branch=master)](https://travis-ci.org/mpfdavis/outputcache)
[![Known Vulnerabilities](https://snyk.io/test/npm/outputcache/badge.svg)](https://snyk.io/test/npm/outputcache)
[![Test Coverage](https://coveralls.io/repos/mpfdavis/outputcache/badge.svg?branch=master&service=github)](https://coveralls.io/github/mpfdavis/outputcache?branch=master)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/315fc61665cb4871a55314cffad0c3f6)](https://www.codacy.com/app/mpfdavis/outputcache?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=mpfdavis/outputcache&amp;utm_campaign=Badge_Grade)

Cache api responses, react and more using Redis, Memcached or any other cache provider. 

## Why?
 
Simple middleware - inject and it will cache the output and headers of each response. This makes it easy to create a highly scalable [Redis cache for your Node API](#using-an-alternative-cache-provider---redis) or simply boost the throughput of your Node application if using a heavier render engine such as React.

Outputcache will honour the status, max-age, no-store, no-cache, private and stale-while-revalidate headers from your original response for ttl by default. This enables your services to dynamically dictate the ttl of each response using http rules. It is also highly configurable - [see API](#api).

- Fast - returns original response directly from cache and uses optimised version of LRU cache by default (Maps)
- Simple - honours all original headers, status codes and requires few code changes
- Flexible - use any cache provider under the hood, in-process or remote such as Redis cache
- Well tested - many unit tests, load tested and used in production


## Installation
```
npm install outputcache --save
```


## Dependencies

Only an optional local cache - 'stale-lru-cache'. This was chosen as it outperforms alternatives in [benchmarks](https://github.com/cyberthom/stale-lru-cache/tree/master/benchmark/results) and enables you to get going quickly. You can easily override this with Redis or any other - [see API](#api). 


## Initialize

```javascript
const OutputCache = require('outputcache');
const xoc = new OutputCache({ varyByQuery: ['page', 'sort'] }); //see api below for more options
```


## Usage

The following example places Outputcache before "api.middleware" - this ensures all cached responses return as soon as possible and avoid any subsequent data gathering or processing.

### Cache select routes

```javascript
const xoc = new OutputCache();

app.get('/api/:channel', xoc.middleware, api.middleware, (req, res) => {    
  res.set({'Cache-Control': 600});  
  res.json({hello:'world'}); //will be hit once every 10 minutes 
});

app.get('/', xoc.middleware, api.middleware, (req, res) => {  
  res.set({'Cache-Control': 600});  
  res.render('hello', {hello:'world'}); //will be hit once every 10 minutes 
});
```

### Cache all routes

```javascript
const xoc = new OutputCache();

app.use(xoc);

app.get('/api/:channel', xoc.middleware, api.middleware, (req, res) => {    
  res.set({'Cache-Control': 600});  
  res.json({hello:'world'}); //will be hit once every 10 minutes 
});
```

### Cache redirects

Redirects can be expensive if they are made based on data, these are cached the same as other responses - this can be disabled using skip3xx

```javascript
const xoc = new OutputCache();

app.get('/api/:channel', xoc.middleware, api.middleware, (req, res) => {    
  res.set({'Cache-Control': 600});  
  res.redirect(301, '/api/us/:channel'); //will be hit once every 600 minutes 
});
```


## Using an alternative cache provider - Redis

Outputcache supports any cache provider by exposing its cache interface on its own 'cacheProvider' property. The only requirement is that your custom cacheProvider returns a Promise for its get method.

The example below shows how Redis can be used as the cacheProvider. 

```javascript
const xoc = require('outputcache');
const redis = require('redis');
const client = redis.createClient();

const xoc = new OutputCache({
    cacheProvider: {
        cache: client, //redis is now cache 
        get: key => {
            //the standard redis module does not return a promise...
            return new Promise(resolve => {
                xoc.cacheProvider.cache.get(key, function (err, result) {
                    return resolve(result);
                });
            });
        },
        set: (key, item, ttl) => {
            xoc.cacheProvider.cache.set(key, item);
            xoc.cacheProvider.cache.expire(key, ttl);
        }
    }
});
```

## Silent failover

If there is an error with the cache provider e.g. your Redis connection or within your custom get/set, Outputcache will not bubble the error to the client using next(err) in order to remain transparent and provide failover. This allows your original route to serve a 200 if Redis fails and allows you to silently log any cache errors by listening for the 'cacheProviderError' event ([see events](#events)).


## API

### `Constructor(options)`

* `options.ttl`: *(default: `600`)* the standard ttl as number in seconds for each cache item (used when `options.useCacheHeader` is false)
* `options.maxItems`: *(default: `1000`)* the number of items allowed in the cache before older, unused items are pushed out - this can be set much higher for 'out of process' caches such as Redis
* `options.useCacheHeader`: *(default: `true`)* use the max-age cache header from the original response as ttl by default. If you set this to false the `options.ttl` or default is used instead
* `options.varyByQuery`: *(default: `true`)* accepts a boolean or array - true/false to use all/ignore all or array to use only specific querystring arguments in the cache key
* `options.varyByCookies`: *(default: `[]`)* accepts an array of cookie names - the cache key will include the value of the named cookie if found in the request
* `options.allowSkip` *(default: true)*  allow or disable forced cache misses (see below) - useful for debugging or dev time
* `options.skip3xx`: *(default: false)* never cache 3xx responses
* `options.skip4xx`: *(default: false)* never cache 4xx responses
* `options.skip5xx`: *(default: false)* never cache 5xx responses
* `options.noHeaders`: *(default: false)* do not add x-output-cache headers to the response - useful for security if you wish to hide server technologies
* `options.staleWhileRevalidate`: *(default: 0)* the default cache provider supports the stale-while-revalidate ttl from the header or will use this setting if options.useCacheHeader is false
* `options.caseSensitive`: *(default: true)* cache key is case-sensitive by default, this can be disabled to minimise cache keys.
* `options.cacheProvider`: *(default: Object)*  interface for the internal cache and its get/set methods - see above example for override settings.


**Note:** `options.varyByCookies` requires you to register a cookie parser such as the 'cookie-parser' module in your application before Outputcache.


### Methods

`.middleware(req, res, next)`

The main middleware of the module, exposes the standard req, res, next params - see examples above.

---

`cacheProvider.get(key)`

The get method used by the cacheProvider for returning a cache item (must return a promise).

---

`cacheProvider.set(key, item, ttl)`

The set method used by the cacheProvider for returning a cache item.


### Events

```javascript
xoc.on('hit', cacheItem => //{cache hit}

xoc.on('miss', info =>  //{url missed}

xoc.on('cacheProviderError', err => //log problem with cache engine or get/set overrides
```


## Logging

Passing an instance of a logger to outputcache is no longer supported - hits, misses or cache errors can be logged by listening [for events](#events) on the outputcache instance. This gives the developer greater control over the log format etc.


## HTTP Headers

- Will add 'x-output-cache ms/ht {ttl} {swr}' to the response headers to indicate a miss/hit/ttl for the response and the value of the staleWhileRevalidate in cache if in use
- Will honour all headers assigned to the original response, including for redirects
- The x-output-cache header can be disabled by setting `options.noHeaders` to true
- Responses with no-store, no-cache and private cache-control headers are never cached


## Force cache skip (client-side/request bypass)

It may be useful to skip outputcache completely for specific requests, you can force a cache skip (miss) when the allowSkip option is true (default) and:

- The querystring collection contains 'cache=false' value pair.
- The request has an 'x-output-cache' header set with the value 'ms'
- The request has an x-output-cache cookie with value 'ms'

This behaviour can be disabled by setting `options.allowSkip` to false

### Status skip

You can configure outputcache to automatically skip caching responses based on your original status codes too ([skip3xx, skip4xx, skip5xx](#api)), these settings are unaffected by `options.allowSkip`


## Performance

Outputcache has more impact on your application performance the more it gets hit, to help maximise performance:

- Ensure cache keys are as simple as possible; disable querystring and cookie based caching or only allow specific querystring args to be used as keys.
- Use [case-insensitive cache keys](#api) if your application [supports them](#troubleshooting).
- Place outputcache as early in the request/response pipeline as possible; to minimise as much code as possible from executing, you should execute outputcache as the first middleware in your routing (after any cookie, body parsers have fired at the server level).
- Increase your cache size; V8 only gets 1.72GB memory assigned to the process by default, ensure you set a sensible maxItems ceiling, or if you have memory available you could increase --max_old_space_size=MB.
- Increase ttl of responses; if you can set a longer ttl, you should. In cases where some responses can be cached for a longer time than others, you should use cache-control headers to vary ttl for different responses and increase it where possible.
- Cache 5xx (default) - errors are expensive, especially exceptions. Throwing the same errors for the same requests will severely impact performance - you should log them and outputcache can serve subsequent error responses from cache.

Under a high ratio of cache hits to misses, you will begin to see an inverse relationship between requests and latency


![requests](https://www.dropbox.com/s/of1d38r9l3yx4km/Screen%20Shot%202017-01-13%20at%2015.26.30.png?raw=1)
![latency](https://www.dropbox.com/s/prxts69zp1obcel/Screen%20Shot%202017-01-13%20at%2015.26.55.png?raw=1)


## Troubleshooting

- You can only cache serializable data - if you override the set or get cacheProvider methods, you should avoid stringifying or parsing the cache item - outputcache does this internally already. 
- If you are only seeing x-output-cache : 'ms' headers in the response, you might be throwing an error in your cache provider or a custom get/set method - see [silent failover](#silent-failover). 
- If your application performs redirects in routes or middleware where outputcache is used, you should place outputcache before these.
- `options.caseSensitive` - if you disable this option (enabled by default), ensure your application is not case-sensitive to querystring or cookie arguments, if these are enabled too.
- `options.varyByCookies` - you must register a cookier parser before outputcache in the req/res lifecycle. This is usually done at the http server level using a module such as cookie-parser. In general, you should place outputcache after cookie and body parsers but before other middleware.


## TODO:

- Add integration tests for common use cases
- Method to support any node server (without middleware).
- Add load test data and benchmarks.