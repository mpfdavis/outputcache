var request = require("supertest");
var requireNew = require("require-new");
var express = require("express");
var app = express();
var cookieParser = require("cookie-parser");
app.use(cookieParser());

var OutputCache = requireNew("../src/outputcache");
var cacheHeaders = new OutputCache();
var cacheNoHeaders = new OutputCache({ noHeaders: true });
var cacheCaseIns = new OutputCache({ caseSensitive: false });
var cache = new OutputCache({ varyByQuery: true, staleWhileRevalidate: 700, varyByCookies: ["hello"] });

app.get("/GetJSON", cache.middleware, function (req, res) {
    
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ hello: "world" });
});

app.get("/GetHtml", cache.middleware, function (req, res) {
    res.status(200).send("<html></html>");
});

app.get("/GetHtmlHeaderTtl", cacheHeaders.middleware, function (req, res) {
    res.set({ "Cache-Control": "max-age=1068, stale-while-revalidate=2000" });
    res.status(200).send("<html></html>");
});

app.get("/GetHtmlCustomHeaders", cache.middleware, function (req, res) {
    res.set({ "X-Custom": "custom-header" });
    res.status(200).send("<html></html>");
});

app.get("/GetHtmlSkipHeader", cache.middleware, function (req, res) {
    res.set({ "X-Output-Cache": "ms" });
    res.status(200).send("<html></html>");
});

app.get("/GetHtmlCustomCacheControl", cache.middleware, function (req, res) {
    res.set({ "Cache-Control": "max-age=722" });
    res.status(200).send("<html></html>");
});

app.get("/GetHtmlInvalidCacheControl", cache.middleware, function (req, res) {
    res.set({ "Cache-Control": "max-age=wrong" });
    res.status(200).send("<html></html>");
});

app.get("/GetHtmlInvalidCacheControl2", cache.middleware, function (req, res) {
    res.set({ "Cache-Control": "676" });
    res.status(200).send("<html></html>");
});

app.get("/GetHtmlNoStore", cache.middleware, function (req, res) {
    res.set({ "Cache-Control": "no-store" });
    res.status(200).send("<html></html>");
});
app.get("/GetHtmlNoCache", cache.middleware, function (req, res) {
    res.set({ "Cache-Control": "no-cache" });
    res.status(200).send("<html></html>");
});

app.get("/GetHtmlPrivate", cache.middleware, function (req, res) {
    res.set({ "Cache-Control": "private" });
    res.status(200).send("<html></html>");
});

app.get("/GetRedirect", cache.middleware, function (req, res) {
    res.redirect(301, "/RedirectTarget");
});

app.get("/RedirectTarget", cache.middleware, function (req, res) {
    res.status(200).send("<html></html>");
});

app.get("/qStringBasedContent", cache.middleware, function (req, res) {
    var output = "querystring says hello " + req.query.hello;
    res.status(200).send(output);
});

app.get("/cookieBasedContent", cache.middleware, function (req, res) {
    var output = "cookie says hello " + req.cookies.hello;
    res.status(200).send(output);
});

app.get("/GetHtmlNoHeader", cacheNoHeaders.middleware, function (req, res) {
    res.set({ "Cache-Control": "max-age=500" });
    res.status(200).send("<html></html>");
});

app.get("/GetHtmlInSensitive", cacheCaseIns.middleware, function (req, res) {
    res.status(200).send("<html></html>");
});


describe("GET JSON with headers and status", function () {

    it("origin responds with json and cache miss header", function (done) {
        request(app)
            .get("/GetJSON")
            .set("Accept", "application/json")
            .expect("Content-Type", /json/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, { hello: "world" }, done);
    });

    it("cache responds with json and cache hit header", function (done) {
        request(app)
            .get("/GetJSON")
            .set("Accept", "application/json")
            .expect("Content-Type", /json/)
            .expect("X-Output-Cache", /ht 600 700/)
            .expect(200, { hello: "world" }, done);
    });
});

describe("GET HTML with headers and status", function () {

    it("origin responds with html and cache miss header", function (done) {
        request(app)
            .get("/GetHtml")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "<html></html>", done);
    });

    it("cache responds with html and cache hit header", function (done) {
        request(app)
            .get("/GetHtml")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ht 600 700/)
            .expect(200, "<html></html>", done);
    });
});

describe("GET Redirect with status and result", function () {

    it("origin responds with 301 and cache miss header", function (done) {
        request(app)
            .get("/GetRedirect")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(301, done);
    });

    it("cache responds with 301 and cache hit header", function (done) {
        request(app)
            .get("/GetRedirect")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ht 600 700/)
            .expect(301, done);
    });

});

describe("Honours cache miss headers", function () {

    it("no-store cache header causes ms", function (done) {
        request(app)
            .get("/GetHtmlNoStore")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "<html></html>");

        request(app)
            .get("/GetHtmlNoStore")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "<html></html>", done);
    });

    it("no-cache cache header causes ms", function (done) {
        request(app)
            .get("/GetHtmlNoCache")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "<html></html>");

        request(app)
            .get("/GetHtmlNoCache")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "<html></html>", done);
    });

    it("private cache header causes ms", function (done) {
        request(app)
            .get("/GetHtmlPrivate")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "<html></html>");

        request(app)
            .get("/GetHtmlPrivate")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "<html></html>", done);
    });

});

describe("Honours custom headers", function () {
    it("origin returns a custom header", function (done) {
        request(app)
            .get("/GetHtmlCustomHeaders")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect("X-Custom", /custom-header/)
            .expect(200, "<html></html>", done);
    });

    it("cache returns same custom header as origin", function (done) {
        request(app)
            .get("/GetHtmlCustomHeaders")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ht 600 700/)
            .expect("X-Custom", /custom-header/)
            .expect(200, "<html></html>", done);
    });
});

describe("Honours cache control", function () {

    it("origin returns cache-control value", function (done) {
        request(app)
            .get("/GetHtmlCustomCacheControl")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect("Cache-Control", /max-age=722/)
            .expect(200, "<html></html>", done);
    });

    it("cache returns same cache control value as origin", function (done) {
        request(app)
            .get("/GetHtmlCustomCacheControl")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ht 722 0/)
            .expect("Cache-Control", /max-age=722/)
            .expect(200, "<html></html>", done);
    });

    it("returns default cache control header if none set", function (done) {
        request(app)
            .get("/GetHtml")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ht 600 700/)
            .expect("Cache-Control", /max-age=600/)
            .expect("Cache-Control", /stale-while-revalidate=700/)
            .expect(200, "<html></html>", done);
    });

    it("origin returns supplied max-age when invalid", function (done) {
        request(app)
            .get("/GetHtmlInvalidCacheControl")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect("Cache-Control", /max-age=wrong/)
            .expect(200, "<html></html>", done);
    });

    it("cache miss for invalid cache control header", function (done) {
        request(app)
            .get("/GetHtmlInvalidCacheControl")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect("Cache-Control", /max-age=wrong/)
            .expect(200, "<html></html>", done);
    });

    it("cache miss for invalid cache control header with integer", function (done) {
        request(app)
            .get("/GetHtmlInvalidCacheControl2")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect("Cache-Control", /676/)
            .expect(200, "<html></html>", done);
    });

    it("cache uses headers for ttl if useCacheHeader not false", function (done) {
        request(app)
            .get("/GetHtmlHeaderTtl")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect("Cache-Control", /max-age=1068, stale-while-revalidate=2000/)
            .expect(200, "<html></html>", function () {
                request(app)
                    .get("/GetHtmlHeaderTtl")
                    .set("Accept", "text/html")
                    .expect("Content-Type", /html/)
                    .expect("X-Output-Cache", /ht 1068 2000/)
                    .expect(200, "<html></html>", done);
            });
    });

});

describe("Honours querystring", function () {

    it("origin honours querystring if value set", function (done) {
        request(app)
            .get("/qStringBasedContent?hello=world")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "querystring says hello world", done);
    });

    it("cache honours querystring if value set", function (done) {
        request(app)
            .get("/qStringBasedContent?hello=world")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ht 600 700/)
            .expect(200, "querystring says hello world", done);
    });

    it("cache miss if querystring changes key", function (done) {
        request(app)
            .get("/qStringBasedContent?hello=dave")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "querystring says hello dave", done);
    });

});

describe("Honours cookies", function () {

    it("origin returns different content based on cookie", function (done) {
        request(app)
            .get("/cookieBasedContent")
            .set("Accept", "text/html")
            .set("Cookie", ["hello=world"])
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "cookie says hello world", done);
    });

    it("cache returns same content based on cookie", function (done) {
        request(app)
            .get("/cookieBasedContent")
            .set("Accept", "text/html")
            .set("Cookie", ["hello=world"])
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ht 600 700/)
            .expect(200, "cookie says hello world", done);
    });

    it("cache miss if cookie value changes", function (done) {
        request(app)
            .get("/cookieBasedContent")
            .set("Accept", "text/html")
            .set("Cookie", ["hello=dave"])
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "cookie says hello dave", done);
    });

});

describe("Cache skip", function () {

    it("cache skip if querystring contains cache=false value pair", function (done) {
        //miss
        request(app)
            .get("/qStringBasedContent?hello=dave")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "querystring says hello dave");
        //hit     
        request(app)
            .get("/qStringBasedContent?hello=dave")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ht 600 700/)
            .expect(200, "querystring says hello dave");
        //force skip
        request(app)
            .get("/qStringBasedContent?hello=dave&cache=false")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "querystring says hello dave", done);

    });

    it("cache skip if x-output-cache header with ms supplied by origin", function (done) {

        request(app)
            .get("/GetHtmlSkipHeader")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "<html></html>");

        request(app)
            .get("/GetHtmlSkipHeader")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "<html></html>", done);

    });

});

describe("Honours no header setting", function () {

    it("response headers do not have x-output-cache header if noHeaders is set ms/ht", function (done) {
        //miss
        request(app)
            .get("/GetHtmlNoHeader")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect(200, "<html></html>")
            .expect(function xocHeaderMissing(res) {
                if (res.get("x-output-cache")) {
                    throw new Error("Expected x-output-cache header to be missing but was found");
                }
            }, function () {
                //hit
                request(app)
                    .get("/GetHtmlNoHeader")
                    .set("Accept", "text/html")
                    .expect("Content-Type", /html/)
                    .expect(200, "<html></html>")
                    .expect(function xocHeaderMissing(res) {
                        if (res.get("x-output-cache")) {
                            throw new Error("Expected x-output-cache header to be missing but was found");
                        }
                    });
            }).end(done);

    });

});

describe("Casing toggle", function () {

    it("cache miss when key casing changes and caseSensitive enabled (default)", function (done) {

        request(app)
            .get("/GetHtmlHeaderTtl?test=lower")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "<html></html>", function () {
                request(app)
                    .get("/GetHtmlHeaderTtl?TEST=LOWER")
                    .set("Accept", "text/html")
                    .expect("Content-Type", /html/)
                    .expect("X-Output-Cache", /ms/)
                    .expect(200, "<html></html>", done);
            });

    });

    it("cache hit when key casing changes and caseSensitive disabled", function (done) {
        request(app)
            .get("/GetHtmlInSensitive?test=lower")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "<html></html>", function () {
                request(app)
                    .get("/GetHtmlInSensitive?TEST=LOWER")
                    .set("Accept", "text/html")
                    .expect("Content-Type", /html/)
                    .expect("X-Output-Cache", /ht 600 0/)
                    .expect(200, "<html></html>", done);
            });
    });

});