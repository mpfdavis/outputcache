var request = require('supertest')
var requireNew = require('require-new');
var express = require('express');
var app = express();

var MockRedisClient = require('mock-redis-client');
var client = new MockRedisClient();
var OutputCache = requireNew('../src/outputcache');

//override default cache provider with redis cache client and get/set methods for redis
var xoc = new OutputCache({
    cacheProvider: {
        cache: client,
        get: key => {
            return new Promise(resolve => {
                xoc.cacheProvider.cache.get(key, function (err, result) {
                    if(err || !result) {
                        return resolve(null);
                    }
                    return resolve(JSON.parse(result));
                });
            });
        },
        set: (key, item, ttl) => {
            xoc.cacheProvider.cache.set(key, JSON.stringify(item));
            xoc.cacheProvider.cache.expire(key, ttl);
        }
    }
});

//mock application routes
app.get('/GetRedis', xoc.middleware, function (req, res) {
    res.status(200).send('<html><html>');
});

//tests
describe('Redis cache provider', function () {

    it('use redis as cache when redis client is cacheProvider', function (done) {
        request(app)
            .get('/GetRedis')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ms/)
            .expect(200, function () {
                request(app)
                    .get('/GetRedis')
                    .set('Accept', 'text/html')
                    .expect('Content-Type', /html/)
                    .expect('X-Output-Cache', /ht 600/)
                    .expect(200, done);
            });
    })

})