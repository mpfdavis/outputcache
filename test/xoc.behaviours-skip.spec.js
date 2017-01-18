var request = require("supertest");
var requireNew = require("require-new");
var express = require("express");
var app = express();

var OutputCache = requireNew("../src/outputcache");
var cache = new OutputCache({ varyByQuery: ["hello", "foo"], allowSkip: false, skip3xx: true, skip4xx: true, skip5xx: true });

app.get("/GetHtmlNoSkip", cache.middleware, function (req, res) {
    res.status(200).send("<html></html>");
});

app.get("/GetHtmlSkip3xx", cache.middleware, function (req, res, next) {
    res.status(301).send("<html></html>");
});

app.get("/GetHtmlSkip4xx", cache.middleware, function (req, res, next) {
    res.status(404).send("<html></html>");
});

app.get("/GetHtmlSkip5xx", cache.middleware, function (req, res, next) {
    res.status(500).send("<html></html>");
});

describe("Disable cache deliberate cache skip via request", function () {

    it("disable cache skip with allowSkip property", function (done) {

        request(app)
            .get("/GetHtmlNoSkip?cache=false")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(200, "<html></html>", function () {
                request(app)
                    .get("/GetHtmlNoSkip?cache=false")
                    .set("Accept", "text/html")
                    .expect("Content-Type", /html/)
                    .expect("X-Output-Cache", /ht 600/)
                    .expect(200, "<html></html>", done);
            });
    });
});

describe("skip cache for specific status codes", function () {

    it("cache skip for 301 when skip3xx is true", function (done) {
        //cache miss
        request(app)
            .get("/GetHtmlSkip3xx")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(301, "<html></html>", function () {
                request(app)
                    .get("/GetHtmlSkip3xx")
                    .set("Accept", "text/html")
                    .expect("Content-Type", /html/)
                    .expect("X-Output-Cache", /ms/)
                    .expect(301, "<html></html>", done);
            });

    });

    it("cache skip for 404 when skip4xx is true", function (done) {
        //cache miss
        request(app)
            .get("/GetHtmlSkip4xx")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(404, "<html></html>", function () {
                request(app)
                    .get("/GetHtmlSkip4xx")
                    .set("Accept", "text/html")
                    .expect("Content-Type", /html/)
                    .expect("X-Output-Cache", /ms/)
                    .expect(404, "<html></html>", done);
            });

    });

    it("cache skip for 500 when skip5xx is true", function (done) {
        //cache miss
        request(app)
            .get("/GetHtmlSkip5xx")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            .expect("X-Output-Cache", /ms/)
            .expect(500, "<html></html>", function () {
                request(app)
                    .get("/GetHtmlSkip5xx")
                    .set("Accept", "text/html")
                    .expect("Content-Type", /html/)
                    .expect("X-Output-Cache", /ms/)
                    .expect(500, "<html></html>", done);
            });

    });

});