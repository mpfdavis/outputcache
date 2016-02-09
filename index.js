//cache provider
var CacheManager = require('stale-lru-cache');
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
    
    //instance
    _localCache = new CacheManager({ maxSize: _options.maxItems || _defaultMaxSize, defaultTTL: _options.ttl || _localCacheTtl });
}

//common headers
var _cacheHeader = 'X-Output-Cache';
var _cacheHeaderMiss = 'ms';
var _cacheHeaderHit = 'ht';

//private interface
var _outputCache = {

	helpers: {

		setHeadersOnCacheItem: function onSetHeaders(req, res, cacheItem) {
            
            cacheItem.headers = res._headers || {};

			//ensure cache control set
			var responseCacheHeader = cacheItem.headers['cache-control'];
            
            if(!responseCacheHeader) {
                cacheItem.headers['cache-control'] = 'max-age=' + (_options.ttl || _localCacheTtl);
            }

			return cacheItem;

		},
	    getTtlFromStr: function onGetTtlFromStr(str) {

	    	//check
	    	if(!str){return null;}
			//first number in string
			var regex = /\d+/;
			//match, extract
			var ttlFromStr = str.match(regex);
			//parse
			var ttlInt = _.parseInt(ttlFromStr, 10);

			return ttlInt;

		},
		setLocalCache: function onSetLocalCache(cacheKey, cacheItem, ttlFromCacheHeader) {
            
			//set response to cache, optionally using cache http header for ttl
			if (_options.useCacheHeader == false) {
				cacheItem.ttl = _options.ttl || _localCacheTtl;
				_localCache.set(cacheKey, cacheItem, cacheItem.ttl);
			} else {
			    cacheItem.ttl = ttlFromCacheHeader || (_options.ttl || _localCacheTtl);
				_localCache.set(cacheKey, cacheItem, cacheItem.ttl);
			}

		}
	},
	middleware: function onOutputCache(req, res, next) {

		//support forced cache skip via querystring or cache miss headers
		var isCacheSkip = ((req.get(_cacheHeader) && req.get(_cacheHeader) === _cacheHeaderMiss) || req.query.cache === "false");

		if(isCacheSkip) {           
			//set header to show this request missed output cache
			res.set({'X-Output-Cache': 'ms'});
			//exit early and flow to middleware
			return next();
		}

		//simple cache key based url or path, lowercase all keys to limit key complexity
		var cacheKey = _options.varyByQuery == false ? 'path-' + req.path : 'url-' + req.originalUrl;

		//extend cache key with cookie values if requested
		var cookies = req.cookies;
		var cookieNameArray = _options.varyByCookies;

		if(cookies && cookieNameArray && _.isArray(cookieNameArray) && cookieNameArray.length > 0) {

			for(var i = 0; i < cookieNameArray.length; i++){
				if(cookies[cookieNameArray[i]]) {
					//extend cache key with desired cookie value
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
				  var responseToCache = _outputCache.helpers.setHeadersOnCacheItem(req, res , {});

		          //attach status and output of send to our obj
		          responseToCache.status = !_.isUndefined(b) ? a : (_.isNumber(a) ? a : res.statusCode);

		          //attach output html
		          responseToCache.body = !_.isUndefined(b) ? b : (!_.isNumber(a) ? a : null);

		          //get max age header
				  var ttlFromCacheHeader = _outputCache.helpers.getTtlFromStr(responseToCache.headers['Cache-Control']);

		          //set response to cache, optionally using cache http header for ttl
		          _outputCache.helpers.setLocalCache(cacheKey, responseToCache, ttlFromCacheHeader);

		          //set http header cache miss
		          res.set({'X-Output-Cache': 'ms'});

		          //send origin rendered output
		          return res.sendOverride(responseToCache.body);

				}

				//override redirect
				res.redirect = function onOverrideRedirect(status, address) {
				    
				    //setup our cache object with headers
					var redirectResponse = _outputCache.helpers.setHeadersOnCacheItem(req, res , {});
					redirectResponse.original = req.originalUrl;
					redirectResponse.redirect = address;
					redirectResponse.status = status || 302;

					//get max age header
				    var ttlFromCacheHeader = _outputCache.helpers.getTtlFromStr(redirectResponse.headers['Cache-Control']);                  
                    
		            //set response to cache, optionally using cache http header for ttl
		            _outputCache.helpers.setLocalCache(cacheKey, redirectResponse, ttlFromCacheHeader);
                    
                    //set http header cache miss for this response
		            res.set({'X-Output-Cache': 'ms'});

		            //send origin redirect
					return res.redirectOverride(status, address);
				}

				//exit to next middleware
				return next();


			} else {

				/* serve straight from memory */

				//set headers from cache, including ht
				res.set(cacheResult.headers);
                
                res.set({'X-Output-Cache': 'ht'})

				//set status from cache
				res.statusCode = cacheResult.status;
                
                //set logger
                var logger = null;
                
                if(_options.logger && _options.logger.info || req.app.logger && req.app.logger.info) {
                    logger = _options.logger || req.app.logger;
                }

				//redirects
				if(cacheResult.redirect) {

					if(logger) {
						logger.info(JSON.stringify({metric:'hit-ratio', name: 'outputcache redirect', desc:'outputcache redirect', data: { requestPath:  cacheResult.original, redirectAddress: cacheResult.redirect, status: cacheResult.status, cacheKey: cacheKey, ttl: cacheResult.ttl}})); 
					}
					//exit middleware with redirect
					return res.redirect(cacheResult.status, cacheResult.redirect);
				}

				//sends/renders
				if(logger) {                    
					logger.info(JSON.stringify({metric:'hit-ratio', name: 'outputcache render', desc: 'outputcache hit', data:{requestPath: req.originalUrl, cacheKey: cacheKey, ttl: cacheResult.ttl}}));
				}

				//exit middleware with send (default)
				return res.send(cacheResult.body);

			}
            
	}

}

//public interface
OutputCache.prototype.middleware = _outputCache.middleware;
module.exports = OutputCache;