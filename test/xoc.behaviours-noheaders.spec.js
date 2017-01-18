var request = require("supertest");
var requireNew = require("require-new");
var express = require("express");
var app = express();

var OutputCache = requireNew("../src/outputcache");
var cacheNoHeader = new OutputCache({ useCacheHeader: false, ttl: 600});
var cacheNoHeaderNoTtl = new OutputCache({ useCacheHeader: false});

//mock application routes
app.get("/GetHtmlCustomCacheControl2", cacheNoHeader.middleware, function (req, res) {
    res.set({ "Cache-Control": "max-age=722"});
    res.status(200).send("<html></html>");
});

app.get("/GetHtmlDefaultTTl", cacheNoHeaderNoTtl.middleware, function (req, res) {
    res.set({ "Cache-Control": "max-age=1000"});
    res.status(200).send("<html></html>");
});

app.get("/GetHtmlCustomCacheControl2?cache=false", cacheNoHeader.middleware, function (req, res) {
    res.status(200).send("<html></html>");
});


describe("Ignore cache-control header when useCacheHeader false", function () {
    
    it("origin returns cache header 722 for cache item with 600 ttl", function (done) {
        request(app)
            .get("/GetHtmlCustomCacheControl2")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect("Cache-Control", /max-age=722/)
            .expect(200, "<html></html>", done);
    });
    
    it("cache returns cache header 722 for cache item with 600 ttl", function (done) {
        request(app)
            .get("/GetHtmlCustomCacheControl2")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ht 600/)
            .expect("Cache-Control", /max-age=722/)
            .expect(200, "<html></html>", done);
    });
});

describe("Use local default ttl if no cache control and no option ttl", function () {
    
    it("default ttl", function (done) {
        request(app)
            .get("/GetHtmlDefaultTTl")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "<html></html>", done);
    });
    
    it("default ttl", function (done) {
        request(app)
            .get("/GetHtmlDefaultTTl")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            //hit shows cache value is 600
            .expect("X-Output-Cache", /ht 600/)
            .expect(200, "<html></html>", done);
    });
});