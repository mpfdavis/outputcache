//cache provider
var SLRU = require('stale-lru-cache');
//utils
var _ = require('lodash');

//settings
var _options;
var _localCacheTtl = 600;
var _defaultMaxSize = 1000;

//local cache
var _localCache;

function OutputCache(options) {

    _options = options || {};
    this.ttl = _options.ttl; //int
    this.maxItems = _options.maxItems; //int
    this.logger = _options.logger; //logger instance
    this.varyByQuery = _options.varyByQuery; //bool
    this.useCacheHeader = _options.useCacheHeader; //bool
    this.varyByCookies = _options.varyByCookies; //array
    this.skip4xx = _options.skip4xx;
    this.skip3xx = _options.skip3xx;
    this.skip5xx = _options.skip5xx;   

    //instance
    _localCache = new SLRU({
        maxSize: _options.maxItems || _defaultMaxSize,
        defaultTTL: _options.ttl || _localCacheTtl
    });
}

//private interface
var _outputCache = {

    helpers: {

        setHeadersOnCacheItem: function onSetHeaders(req, res, cacheItem, headers) {

            //set passed in headers
            cacheItem.headers = headers;

            //ensure this includes cache control
            var responseCacheHeader = headers['cache-control'];

            if (!responseCacheHeader) {
                cacheItem.headers['cache-control'] = 'max-age=' + (_options.ttl || _localCacheTtl);
            }

            return cacheItem;

        },
        getTtlFromStr: function onGetTtlFromStr(str) {

            var regex = /\d+/;
            var ttlFromStr = str.match(regex);
            var ttlInt = _.parseInt(ttlFromStr, 10);

            return ttlInt;

        },
        setLocalCache: function onSetLocalCache(cacheKey, cacheItem, ttlFromCacheHeader) {

            //set response to cache, optionally using cache http header for ttl
            if (_options.useCacheHeader === false) {
                cacheItem.ttl = _options.ttl || _localCacheTtl;
                _localCache.set(cacheKey, cacheItem, cacheItem.ttl);
            } else {
                cacheItem.ttl = ttlFromCacheHeader || (_options.ttl || _localCacheTtl);
                _localCache.set(cacheKey, cacheItem, cacheItem.ttl);
            }

        }
    },
    middleware: function onOutputCache(req, res, next) {

        //headers collection
        var resHeadersRaw = res._headers || {};

        //support forced cache skip via querystring or cache miss headers
        var isCacheSkip = ((resHeadersRaw['x-output-cache'] && resHeadersRaw['x-output-cache'] === 'ms') || req.query.cache === "false");

        if (isCacheSkip) {
            //set header to show this request missed output cache
            res.set({
                'X-Output-Cache': 'ms'
            });
            //exit early and flow to middleware
            return next();
        }

        //simple cache key based url or path, lowercase all keys to limit key complexity
        var cacheKey = _options.varyByQuery == false ? 'path-' + req.path : 'url-' + req.originalUrl;

        //extend cache key with cookie values if requested
        var cookies = req.cookies;
        var cookieNameArray = _options.varyByCookies;

        if (cookies && cookieNameArray && _.isArray(cookieNameArray) && cookieNameArray.length > 0) {

            for (var i = 0; i < cookieNameArray.length; i++) {
                if (cookies[cookieNameArray[i]]) {
                    cacheKey += ('-cookie-' + cookies[cookieNameArray[i]]);
                }
            }

        }

        //lower to help limit complexity
        cacheKey = cacheKey.toLowerCase();

        //check cache
        var cacheResult = _localCache.get(cacheKey);

        if (!cacheResult) {

            /* cache for next time, override response methods */

            res.sendOverride = res.send;
            res.redirectOverride = res.redirect;

            //override send (also used internally by res.render and res.json/p automatically)
            res.send = function onOverrideSend(a, b) {

                //setup our cache object with headers
                var responseToCache = _outputCache.helpers.setHeadersOnCacheItem(req, res, {}, resHeadersRaw);
                
                //set http header cache miss for this response
                res.set({'X-Output-Cache': 'ms'});

                //attach status and output of send to our obj
                responseToCache.status = !_.isUndefined(b) ? a : (_.isNumber(a) ? a : res.statusCode);
                
                //attach output html
                responseToCache.body = !_.isUndefined(b) ? b : (!_.isNumber(a) ? a : null);

                if (responseToCache.status > 200 && (_options.skip4xx || _options.skip5xx)) {
                    return res.sendOverride(responseToCache.body)
                }

                //get max age header
                var ttlFromCacheHeader = _outputCache.helpers.getTtlFromStr(responseToCache.headers['cache-control']);

                //set response to cache, optionally using cache http header for ttl
                _outputCache.helpers.setLocalCache(cacheKey, responseToCache, ttlFromCacheHeader);

                //send origin rendered output
                return res.sendOverride(responseToCache.body);

            }

            //override redirect
            res.redirect = function onOverrideRedirect(status, address) {

                //setup our cache object with headers
                var redirectResponse = _outputCache.helpers.setHeadersOnCacheItem(req, res, {}, resHeadersRaw);
                redirectResponse.original = req.originalUrl;
                redirectResponse.redirect = address;
                redirectResponse.status = status || 302;
                
                //set http header cache miss for this response
                res.set({'X-Output-Cache': 'ms'});

                if (status > 300 && _options.skip3xx) {
                    return res.redirectOverride(status, address);
                }

                //get max age header
                var ttlFromCacheHeader = _outputCache.helpers.getTtlFromStr(redirectResponse.headers['cache-control']);

                //set response to cache, optionally using cache http header for ttl
                _outputCache.helpers.setLocalCache(cacheKey, redirectResponse, ttlFromCacheHeader);

                //send origin redirect
                return res.redirectOverride(status, address);
            }

            //exit to next middleware
            return next();


        } else {

            /* serve straight from memory */

            //set headers from cache, including ht
            res.set(cacheResult.headers);

            res.set({
                'X-Output-Cache': 'ht ' + cacheResult.ttl
            })

            //set status from cache
            res.statusCode = cacheResult.status;

            //set logger
            var logger = null;

            if (_options.logger && _options.logger.info) {
                logger = _options.logger;
            }

            //redirects
            if (cacheResult.redirect) {
                /* istanbul ignore else  */
                if (logger) {
                    logger.info(JSON.stringify({
                        metric: 'hit-ratio',
                        name: 'outputcache',
                        desc: 'ht redirect',
                        data: {
                            request: cacheResult.original,
                            redirect: cacheResult.redirect,
                            status: cacheResult.status,
                            key: cacheKey,
                            ttl: cacheResult.ttl
                        }
                    }));
                }
                
                //exit middleware with redirect
                return res.redirect(cacheResult.status, cacheResult.redirect);

            }

            //sends/renders
            if (logger) {
                logger.info(JSON.stringify({
                    metric: 'hit-ratio',
                    name: 'outputcache',
                    desc: 'ht render',
                    data: {
                        request: req.originalUrl,
                        status: cacheResult.status,
                        key: cacheKey,
                        ttl: cacheResult.ttl
                    }
                }));
            }

            //exit middleware with send (default)
            return res.send(cacheResult.body);

        }

    }

}

//public interface
OutputCache.prototype.middleware = _outputCache.middleware;
module.exports = OutputCache;