var request = require('supertest')
var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
app.use(cookieParser());

var OutputCache = require('../index');

//cache instances
var cache = new OutputCache({ varyByQuery: true, varyByCookies: ['hello'] })


//mock application routes
app.get('/GetJSON', cache.middleware, function (req, res) {
    res.status(200).json({ hello: 'world' });
});

app.get('/GetHtml', cache.middleware, function (req, res) {
    res.status(200).send('<html></html>');
});

app.get('/GetHtmlCustomHeaders', cache.middleware, function (req, res) {
    res.set({ 'X-Custom': 'custom-header' });
    res.status(200).send('<html></html>');
});

app.get('/GetHtmlCustomCacheControl', cache.middleware, function (req, res) {
    res.set({ 'Cache-Control': 'max-age=722' });
    res.status(200).send('<html></html>');
});

app.get('/GetRedirect', cache.middleware, function (req, res) {
    res.redirect(301, '/RedirectTarget');
});

app.get('/RedirectTarget', cache.middleware, function (req, res) {
    res.status(200).send('<html></html>');
});

app.get('/qStringBasedContent', cache.middleware, function (req, res) {    
    var output = 'querystring says hello ' + req.query.hello;   
    res.status(200).send(output);
});

app.get('/cookieBasedContent', cache.middleware, function (req, res) {    
    var output = 'cookie says hello ' + req.cookies.hello;   
    res.status(200).send(output);
});

//tests

describe('GET JSON with headers and status', function () {
 
    it('origin responds with json and cache miss header', function (done) {
        request(app)
            .get('/GetJSON')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect('X-Output-Cache', /ms/)
            .expect(200, { hello: 'world' }, done);
    })

    it('cache responds with json and cache hit header', function (done) {
        request(app)
            .get('/GetJSON')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect('X-Output-Cache', /ht/)
            .expect(200, { hello: 'world' }, done);
    })
})

describe('GET HTML with headers and status', function () {
 
    it('origin responds with html and cache miss header', function (done) {
        request(app)
            .get('/GetHtml')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ms/)
            .expect(200, '<html></html>', done);
    })

    it('cache responds with html and cache hit header', function (done) {
        request(app)
            .get('/GetHtml')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ht/)
            .expect(200, '<html></html>', done);
    })
})

describe('GET Redirect with status and result', function () {
  
    it('origin responds with 301 and cache miss header', function (done) {
        request(app)
            .get('/GetRedirect')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ms/)
            .expect(301, '<p>Moved Permanently. Redirecting to <a href="/RedirectTarget">/RedirectTarget</a></p>', done);
    })

    it('cache responds with 301 and cache hit header', function (done) {
        request(app)
            .get('/GetRedirect')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ht/)
            .expect(301, '<p>Moved Permanently. Redirecting to <a href="/RedirectTarget">/RedirectTarget</a></p>', done);
    })
    
})

describe('Honours custom headers', function () {
    it('origin returns a custom header', function (done) {
        request(app)
            .get('/GetHtmlCustomHeaders')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ms/)
            .expect('X-Custom', /custom-header/)
            .expect(200, '<html></html>', done);
    })
    
    it('cache returns same custom header as origin', function (done) {
        request(app)
            .get('/GetHtmlCustomHeaders')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ht/)
            .expect('X-Custom', /custom-header/)
            .expect(200, '<html></html>', done);
    })
})

describe('Honours cache control', function () {
   
    it('origin returns cache-control value', function (done) {
        request(app)
            .get('/GetHtmlCustomCacheControl')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ms/)
            .expect('Cache-Control', /max-age=722/)
            .expect(200, '<html></html>', done);
    })
    
    it('cache returns same cache control value as origin', function (done) {
        request(app)
            .get('/GetHtmlCustomCacheControl')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ht/)
            .expect('Cache-Control', /max-age=722/)
            .expect(200, '<html></html>', done);
    })
    
    it('returns default cache control header if none set', function (done) {
        request(app)
            .get('/GetHtml')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ht/)
            .expect('Cache-Control', /max-age=600/)
            .expect(200, '<html></html>', done);
    })
    
})

describe('Honours querystring', function () {
   
    it('origin honours querystring if value set', function (done) {
        request(app)
            .get('/qStringBasedContent?hello=world')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ms/)
            .expect(200, 'querystring says hello world', done);
            
    })
    
    it('cache honours querystring if value set', function (done) {
        request(app)
            .get('/qStringBasedContent?hello=world')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ht/)
            .expect(200, 'querystring says hello world', done);
            
    })
    
    it('cache miss if querystring changes key', function (done) {
        request(app)
            .get('/qStringBasedContent?hello=dave')
            .set('Accept', 'text/html')
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ms/)
            .expect(200, 'querystring says hello dave', done);
            
    })
    
        
})

describe('Honours cookies', function () {
       
    it('origin returns different content based on cookie', function (done) {
        request(app)
            .get('/cookieBasedContent')
            .set('Accept', 'text/html')
            .set('Cookie', ['hello=world'])
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ms/)
            .expect(200, 'cookie says hello world', done);            
    })
    
    it('cache returns same content based on cookie', function (done) {
        request(app)
            .get('/cookieBasedContent')
            .set('Accept', 'text/html')
            .set('Cookie', ['hello=world'])
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ht/)
            .expect(200, 'cookie says hello world', done);            
    })
    
    it('cache miss if cookie value changes', function (done) {
        request(app)
            .get('/cookieBasedContent')
            .set('Accept', 'text/html')
            .set('Cookie', ['hello=dave'])
            .expect('Content-Type', /html/)
            .expect('X-Output-Cache', /ms/)
            .expect(200, 'cookie says hello dave', done);            
    })
            
})