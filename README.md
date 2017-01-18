# Outputcache

[![Version](https://img.shields.io/npm/v/outputcache.svg)](https://www.npmjs.com/package/outputcache)
[![License](https://img.shields.io/npm/l/outputcache.svg)](https://www.npmjs.com/package/outputcache)
[![Downloads](https://img.shields.io/npm/dt/outputcache.svg)](https://www.npmjs.com/package/outputcache)
[![Build Status](https://travis-ci.org/mpfdavis/outputcache.svg?branch=master)](https://travis-ci.org/mpfdavis/outputcache)
[![Test Coverage](https://coveralls.io/repos/mpfdavis/outputcache/badge.svg?branch=master&service=github)](https://coveralls.io/github/mpfdavis/outputcache?branch=master)

Cache api responses, react and more using redis, memcached or any other cache provider. 

## Why?
 
Simple middleware, in pure Node - inject as a middleware and it will cache output and headers of your response. This makes it easy to create a highly scalable redis cache for your api or simply boost the throughput of your node application if using a heavier render engine such as React.

Outputcache will honour the status, max-age, no-store, no-cache, private and stale-while-revalidate headers from your original response for ttl by default, making it seamless and your origin able to dynamically dictate the ttl of each response.

- Fast - returns original response directly from cache and uses optimised version of LRU cache by default (Maps)
- Simple - honours all original headers, status codes and requires few code changes
- Flexible - use any cache provider under the hood - in-process or remote such as Redis cache
- Well tested - many unit tests, load tested and used in production


## Installation
```
npm install outputcache --save
```

## Dependencies

None, other than a default in-process cache provider 'stale-lru-cache'. This was chosen as it outperforms alternatives in benchmarks (see its repo), is free of memory leaks and enables you to get going quickly. You can easily override this with redis or any other (see below). 

## Initialize

```javascript
const OutputCache = require('outputcache');
const xoc = new OutputCache({ varyByQuery: ['page', 'sort'] }); //see api below for more options
```

## Usage

- Can be used as a route or global middleware - see examples below. 
- Should be placed as early as possible in the response lifecycle to maximise performance.

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
  res.redirect('/api/us/:channel'); //will be hit once every 600 minutes 
});

```
## Using an alternative cache provider e.g. Redis

Outputcache supports any cache provider by exposing the cache and get/set methods on its own 'cacheProvider' property. The example below shows how Redis can be used. 
The only requirement is that your cache returns a promise - if it doesn't, you can handle this by overriding the get method to wrap the callback in a promise.

```javascript
const xoc = require('outputcache');
const redis = require('redis');
const client = redis.createClient();

const xoc = new OutputCache({
    cacheProvider: {
        cache: client, //redis is now cache 
        get: key => {
            //the standard module does not return a promise, so override get
            return new Promise(resolve => {
                xoc.cacheProvider.cache.get(key, function (err, result) {
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

## API

#### `Constructor(options)`

* `options.ttl`: *(default: `600`)* the standard ttl as number in seconds for each cache item (used when option.useCacheHeader is false)
* `options.maxItems`: *(default: `1000`)* the number of items allowed in the cache before older, unused items are pushed out - this can be set much higher for 'out of process' caches such as redis
* `options.useCacheHeader`: *(default: `true`)* use the max-age cache header from the original response as ttl by default. If you set this to false the options.ttl or default is used instead
* `options.varyByQuery`: *(default: `true`)* accepts a boolean or array - true/false to use all/ignore all or array to use only specific querystring arguments in the cache key
* `options.varyByCookies`: *(default: `[]`)* accepts an array of cookie names - the cache key will include the value of the named cookie if found in the request
* `options.allowSkip` *(default: true)*  allow or disable forced cache misses (see below) - useful for debugging or dev time
* `options.skip3xx`: *(default: false)* never cache 3xx responses
* `options.skip4xx`: *(default: false)* never cache 4xx responses
* `options.skip5xx`: *(default: false)* never cache 5xx responses
* `options.noHeaders`: *(default: false)* do not add x-output-cache headers to the response - useful for security if you wish to hide server technologies
* `options.staleWhileRevalidate`: *(default: 0)* the default cache provider supports the stale-while-revalidate ttl from the header or will use this setting if useCacheHeader is false
* `options.cacheProvider`: *(default: Object)*  interface for the internal cache and its get/set methods - see below for override settings

**Note:** `options.varyByCookies` requires you to register a cookie parser such as the 'cookie-parser' module in your application before Outputcache.


#### Methods

```javascript
xoc.middleware => // (req, res, next)
```

#### Events

```javascript
xoc.on('hit', cacheItem => 

xoc.on('miss', info => 

xoc.on('cacheProviderError', err => 
```


## Logging

Passing an instance of a logger to outputcache is no longer supported - hits, misses or cache errors can be logged by listening for events (see below) on the outputcache instance. This gives the developer greater control over the logging format etc.

## HTTP Headers

- Will add 'x-output-cache ms/ht {ttl} {swr}' to the response headers to indicate a miss/hit the ttl of the response in cache and the value of the staleWhileRevalidate in cache if in use
- Will honour all headers assigned to the original response, including for redirects
- The x-output-cache header can be disabled by setting noHeaders to true
- Responses with no-store, no-cache and private cache-control headers are never cached

## Force cache skip (client-side/request bypass)

It may be useful to skip outputcache completely for specific requests, you can force a cache skip (miss) when the allowSkip option is true (default) and:

- The querystring collection contains 'cache=false' value pair.
- The request has an 'x-output-cache' header set with the value 'ms'
- The request has an x-output-cache cookie with value 'ms'

This behaviour can be disabled by setting allowSkip to false


## Performance

Outputcache has more impact on your application performance the more it gets hit, to help maximise performance:

- Ensure cache keys as simple as possible; disable querystring and cookie based caching or only allow specific querystring args to be used as keys.
- Place outputcache as early in the request/response pipeline as possible; to minimise as much code as possible from executing, you should execute outputcache as the first middleware in your routing (after any cookie, body parsers have fired at the server level).
- Increase your cache size; V8 only gets 1.72GB memory assigned to the process by default, ensure you set a sensible maxItems ceiling, or if you have memory available you could increase --max_old_space_size=MB.
- Increase ttl of responses; if you can set a longer ttl, you should. In cases where some responses can be cached for a longer time than others, you should use cache-control headers to vary ttl for different responses and increase it where possible.

Under a high ratio of cache hits to misses, you will see an inverse relationship between requests and latency

![requests](https://www.dropbox.com/s/of1d38r9l3yx4km/Screen%20Shot%202017-01-13%20at%2015.26.30.png?raw=1)
![latency](https://www.dropbox.com/s/prxts69zp1obcel/Screen%20Shot%202017-01-13%20at%2015.26.55.png?raw=1)

## Troubleshooting

- You can only cache serializable data - if you override the set or get cacheProvider methods, you should avoid stringifying or parsing the cache item - outputcache does this internally already. 
- If you are get only x-output-cache : 'ms headers, you might be throwing an error in your cache provider or a custom get/set method - usually due to serialization. You can check this by listening for the 'cacheProviderError' event (above).
- If your application performs redirects in routes or middleware where outputcache is used, you should place outputcache before these.