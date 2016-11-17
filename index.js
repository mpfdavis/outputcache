var SLRU = require('stale-lru-cache');
var _options;
var _localCacheTtl = 600;
var _defaultMaxSize = 1000;
var _localCache;

function OutputCache(options) {

    _options = options || {};

    _localCache = new SLRU({
        maxSize: _options.maxItems || _defaultMaxSize,
        maxAge: _options.ttl || _localCacheTtl
    });

    if (!_options.varyByCookies || !Array.isArray(_options.varyByCookies)) {
        _options.varyByCookies = [];
    }

    if (_options.noHeaders !== true) {
        _options.noHeaders = false;
    }

    if(!_options.logLevel) {
        _options.logLevel = 'debug';
    }

    this.ttl = _options.ttl;
    this.maxItems = _options.maxItems;
    this.logger = _options.logger;
    this.logLevel = _options.logLevel;
    this.varyByQuery = _options.varyByQuery;
    this.useCacheHeader = _options.useCacheHeader;
    this.varyByCookies = _options.varyByCookies;
    this.skip4xx = _options.skip4xx;
    this.skip3xx = _options.skip3xx;
    this.skip5xx = _options.skip5xx;
    this.noHeaders = _options.noHeaders;
     
}

var _outputCache = {

    helpers: {

        setHeadersOnCacheItem: function onSetHeaders(req, res, cacheItem, headers) {

            cacheItem.headers = headers;
            var responseCacheHeader = headers['cache-control'];

            if (!responseCacheHeader) {
                cacheItem.headers['cache-control'] = 'max-age=' + (_options.ttl || _localCacheTtl);
            }
            return cacheItem;

        },
        getTtlFromStr: function onGetTtlFromStr(str) {

            var regex = /\d+/;
            var ttlFromStr = str.match(regex);
            var ttlInt = parseInt(ttlFromStr, 10);
            return ttlInt;

        },
        setLocalCache: function onSetLocalCache(cacheKey, cacheItem, ttlFromCacheHeader) {

            if (_options.useCacheHeader === false) {
                cacheItem.ttl = _options.ttl || _localCacheTtl;
                _localCache.set(cacheKey, cacheItem, {maxAge: cacheItem.ttl});
            } else {
                cacheItem.ttl = ttlFromCacheHeader || (_options.ttl || _localCacheTtl);
                _localCache.set(cacheKey, cacheItem, {maxAge: cacheItem.ttl});
            }

        }
    },
    middleware: function onOutputCache(req, res, next) {

        var resHeadersRaw = res._headers || {};
        var cookies = req.cookies;
        var isCacheSkip = ((resHeadersRaw['x-output-cache'] && resHeadersRaw['x-output-cache'] === 'ms') || req.query.cache === "false" || (cookies && cookies['x-output-cache'] === 'ms'));

        if (isCacheSkip) {
          
            if (!_options.noHeaders) {
                res.set({ 'X-Output-Cache': 'ms' });
            }
            return next();
        }

        var cacheKey = _options.varyByQuery === false ? 'p-' + req.path : 'u-' + req.originalUrl;
        var cookieNameArray = _options.varyByCookies;
        var cookieNameArrayLength = cookieNameArray.length;

        if (cookies && cookieNameArrayLength > 0) {

            for (var i = 0; i < cookieNameArrayLength; i++) {
                if (cookies[cookieNameArray[i]]) {
                    cacheKey += ('-c-' + cookies[cookieNameArray[i]]);
                }
            }

        }

        var cacheResult = _localCache.get(cacheKey);

        if (!cacheResult) {

            res.sendOverride = res.send;
            res.redirectOverride = res.redirect;

            res.send = function onOverrideSend(a, b) {

                var responseToCache = _outputCache.helpers.setHeadersOnCacheItem(req, res, {}, resHeadersRaw);
                
                if (!_options.noHeaders) {
                    res.set({ 'X-Output-Cache': 'ms' });
                }

                responseToCache.status = b !== undefined ? a : (Number.isInteger(a) ? a : res.statusCode);

                responseToCache.body = b !== undefined ? b : (!Number.isInteger(a) ? a : null);

                if (responseToCache.status > 200 && (_options.skip4xx || _options.skip5xx)) {
                    return res.sendOverride(responseToCache.body);
                }

                var ttlFromCacheHeader = _outputCache.helpers.getTtlFromStr(responseToCache.headers['cache-control']);

                _outputCache.helpers.setLocalCache(cacheKey, responseToCache, ttlFromCacheHeader);

                return res.sendOverride(responseToCache.body);

            }

            res.redirect = function onOverrideRedirect(status, address) {

                var redirectResponse = _outputCache.helpers.setHeadersOnCacheItem(req, res, {}, resHeadersRaw);
                redirectResponse.original = req.originalUrl;
                redirectResponse.redirect = address;
                redirectResponse.status = status || 302;
                
                if (!_options.noHeaders) {
                    res.set({ 'X-Output-Cache': 'ms' });
                }

                if (status > 300 && _options.skip3xx) {
                    return res.redirectOverride(status, address);
                }

                var ttlFromCacheHeader = _outputCache.helpers.getTtlFromStr(redirectResponse.headers['cache-control']);

                _outputCache.helpers.setLocalCache(cacheKey, redirectResponse, ttlFromCacheHeader);

                return res.redirectOverride(status, address);
            }

            return next();


        } else {

            res.set(cacheResult.headers);

            if (!_options.noHeaders) {
                res.set({ 'X-Output-Cache': 'ht ' + cacheResult.ttl });
            }

            res.statusCode = cacheResult.status;

            var logger = _options.logger;
            var logLevel = _options.logLevel;

            if (cacheResult.redirect && logger && logger[logLevel]) {
                logger[logLevel]('{"metric": "hit-ratio", "name": "outputcache", "desc": "ht redirect", "data": { "request":"' + cacheResult.original + '", "redirect": "' + cacheResult.redirect + '", "status": "' + cacheResult.status + '", "key": "' + cacheKey + '", "ttl" : "' + cacheResult.ttl + '"}}');
            } else if (logger && logger[logLevel]) {
                logger[logLevel]('{"metric": "hit-ratio", "name": "outputcache", "desc": "ht render", "data": { "request":"' + req.originalUrl + '", "status": "' + cacheResult.status + '", "key": "' + cacheKey + '", "ttl": "' + cacheResult.ttl + '"}}');
            }
            
            return res.end(cacheResult.body);

        }

    }

}

OutputCache.prototype.middleware = _outputCache.middleware;
module.exports = OutputCache;