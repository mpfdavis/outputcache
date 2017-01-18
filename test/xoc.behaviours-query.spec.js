var request = require("supertest");
var requireNew = require("require-new");
var express = require("express");
var app = express();

var OutputCache = requireNew("../src/outputcache");
var cacheNoQuery = new OutputCache({ varyByQuery: false });
var cacheQuery = new OutputCache({ varyByQuery: ["hello", "foo"] });

//mock application routes
app.get("/GetHtmlIgnoreQuery", cacheNoQuery.middleware, function (req, res) {
    var output = "querystring says hello " + req.query.hello;
    res.status(200).send(output);
});

app.get("/GetHtmlQueryArray", cacheQuery.middleware, function (req, res) {
    res.status(200).send("<html></html>");
});

describe("Ignore querystring for cache key", function () {

    it("origin returns content based on query string", function (done) {
        request(app)
            .get("/GetHtmlIgnoreQuery?hello=world")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            //miss
            .expect("X-Output-Cache", /ms/)
            .expect(200, "querystring says hello world", done);
    });

    it("cache returns same content for same path but different querystring value", function (done) {
        request(app)
            .get("/GetHtmlIgnoreQuery?hello=dave")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            //hit
            .expect("X-Output-Cache", /ht 600/)
            .expect(200, "querystring says hello world", done);
    });
});

describe("cachekey honours querystring", function () {

    it("cache includes querystring for specific querystring arguments only", function (done) {
        request(app)
            .get("/GetHtmlQueryArray?hello=world&foo=bar")
            .set("Accept", "text/html")
            .expect("Content-Type", /html/)
            //miss
            .expect("X-Output-Cache", /ms/)
            .expect(200, "querystring says hello world", function () {
                request(app)
                    .get("/GetHtmlQueryArray?hello=world&foo=bar")
                    .set("Accept", "text/html")
                    .expect("Content-Type", /html/)
                    .expect("X-Output-Cache", /ht 600/)
                    .expect(200, "<html></html>", function () {
                        request(app)
                            .get("/GetHtmlQueryArray?hello=world&foo=bar&gi=go")
                            .set("Accept", "text/html")
                            .expect("Content-Type", /html/)
                            .expect("X-Output-Cache", /ht 600/)
                            .expect(200, "<html></html>", done);

                    });

            });

    });

});
