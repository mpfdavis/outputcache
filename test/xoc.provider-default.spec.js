var request = require('supertest')
var requireNew = require('require-new');
var express = require('express');
var app = express();

const SLRU = require('stale-lru-cache');
var OutputCache = requireNew('../src/outputcache');

//assign 'custom' cache provider with custom get method throwing error
var xoc = new OutputCache({
    cacheProvider: {
        cache: new SLRU({
            maxSize: 1000,
            maxAge: 200
        }),
        get: key => {
            return new Promise(resolve => {
                throw new Error("Throw error in custom get method and expect OutputCache to catch it");
                return resolve(xoc.cacheProvider.cache.get(key));
            });
        }
    }
})

xoc.on('cacheProviderError', function(err){
    //log..
})

//mock application routes
app.get('/GetProviderThrow', xoc.middleware, function (req, res) {
    res.status(200).send('<html><html>');
});

//tests
describe('Default cache provider', function () {

    it('exception thrown by cache provider is caught silently', function (done) {
        request(app)
            .get('/GetProviderThrow')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect(200, done);
    })

})