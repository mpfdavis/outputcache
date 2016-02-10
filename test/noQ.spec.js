var request = require('supertest')
var mocha = require('mocha');
var requireNew = require('require-new');
var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
app.use(cookieParser());

var OutputCache = requireNew('../index');

//cache instances
var cacheNoQuery = new OutputCache({ varyByQuery: false})

//mock application routes
app.get('/GetHtmlIgnoreQuery', cacheNoQuery.middleware, function (req, res) {
    var output = 'querystring says hello ' + req.query.hello;   
    res.status(200).send(output);
});


//tests

describe('Ignore querystring for cache key', function () {
    
    it('origin returns content based on query string', function (done) {
        request(app)
            .get('/GetHtmlIgnoreQuery?hello=world')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            //miss
            .expect('X-Output-Cache', /ms/)
            .expect(200, 'querystring says hello world', done);
    })
    
    it('cache returns same content for same path but different querystring value', function (done) {
        request(app)
            .get('/GetHtmlIgnoreQuery?hello=dave')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            //hit
            .expect('X-Output-Cache', /ht/)
            .expect(200, 'querystring says hello world', done);
    })
})