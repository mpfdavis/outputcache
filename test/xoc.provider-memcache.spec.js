
var request = require('supertest')
var requireNew = require('require-new');
var express = require('express');
var app = express();

var Memcached = require('memcached-mock');
var memcached = new Memcached('localhost:11211');
var OutputCache = requireNew('../src/outputcache');

//override default cache provider with memcached cache client and get/set methods for redis
var xoc = new OutputCache({
    cacheProvider: {
        cache: memcached,
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
            xoc.cacheProvider.cache.set(key, item, ttl.maxAge, function(err){
                // ...     
            });
        }
    }
});

//mock application routes
app.get('/GetMemcached', xoc.middleware, function (req, res) {
    res.status(200).send('<html><html>');
});

//tests
describe('Memcached cache provider', function () {

    it('use memcache as cache when memcached client is cacheProvider', function (done) {
        request(app)
            .get('/GetMemcached')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ms/)
            .expect(200, function () {
                request(app)
                    .get('/GetMemcached')
                    .set('Accept', 'text/html')
                    .expect('Content-Type', /html/)
                    .expect('X-Output-Cache', /ht 600/)
                    .expect(200, done);
            });
    })

})