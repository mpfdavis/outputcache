"use strict";
const SLRU = require("stale-lru-cache");
const url = require("url");
const EventEmitter = require("events").EventEmitter;

module.exports = class OutputCache extends EventEmitter {

    constructor(options = {}) {
        super();
        this.ttl = { maxAge: options.ttl || 600, staleWhileRevalidate: this.staleWhileRevalidate || 0 };
        this.maxItems = options.maxItems || 1000;
        this.staleWhileRevalidate = options.staleWhileRevalidate;
        this.varyByCookies = Array.isArray(options.varyByCookies) ? options.varyByCookies : [];
        this.varyByQuery = options.varyByQuery === false ? false : Array.isArray(options.varyByQuery) ? options.varyByQuery : [];
        this.skip4xx = options.skip4xx;
        this.skip3xx = options.skip3xx;
        this.skip5xx = options.skip5xx;
        this.noHeaders = options.noHeaders;
        this.useCacheHeader = options.useCacheHeader;
        this.allowSkip = options.allowSkip === false ? false : true;
        this.cacheProvider = options.cacheProvider || {
            cache: new SLRU({
                maxSize: this.maxItems,
                maxAge: this.ttl,
                staleWhileRevalidate: this.staleWhileRevalidate
            }),
            get: this.defaultGet.bind(this),
            set: this.defaultSet.bind(this)
        };
        this.middleware = this.middleware.bind(this);
        this._header = "x-output-cache";
    }

    middleware(req, res, next) {

        const urlParsed = url.parse(req.url, true);
        const isSkipForced = this.allowSkip && ((req.headers[this._header] === "ms" || urlParsed.query.cache === "false" || (req.cookies && req.cookies[this._header] === "ms")));
        let cacheKey = `p-${urlParsed.pathname}`;

        if (!this.noHeaders) {
            res.setHeader(this._header, "ms");
        }

        if (isSkipForced) {
            this.emit("miss", { url: urlParsed.path });
            return next();
        }

        if (this.varyByQuery && Object.keys(urlParsed.query).length) {
            if (this.varyByQuery.length) {
                for (let i = 0; i < this.varyByQuery.length; i++) {
                    if (urlParsed.query[this.varyByQuery[i]]) {
                        cacheKey += `-q-${this.varyByQuery[i]}=${urlParsed.query[this.varyByQuery[i]]}`;
                    }
                }
            } else {
                cacheKey += `-q-${urlParsed.search}`;
            }
        }

        if (req.cookies) {
            for (let i = 0; i < this.varyByCookies.length; i++) {
                if (req.cookies[this.varyByCookies[i]]) {
                    cacheKey += `-c-${this.varyByCookies[i]}=${req.cookies[this.varyByCookies[i]]}`;
                }
            }
        }

        this.cacheProvider.get(cacheKey).then((cacheResult) => {

            if (cacheResult) {

                let result = JSON.parse(cacheResult);

                if (!this.noHeaders) {
                    result.headers[this._header] = `ht ${result.ttl.maxAge} ${result.ttl.staleWhileRevalidate}`;
                }
                this.emit("hit", result);
                res.writeHead(result.status, result.headers);
                return res.end(result.body);

            } else {

                res.endOverride = res.end;
                this.emit("miss", { url: urlParsed.path });

                res.end = (data, encoding, cb) => {

                    //deep clone
                    let headers = JSON.parse(JSON.stringify(res._headers || res.headers || {}));

                    if (!headers["cache-control"]) {
                        headers["cache-control"] = `max-age=${this.ttl.maxAge}` + (this.staleWhileRevalidate ? `, stale-while-revalidate=${this.staleWhileRevalidate}` : "");
                    }

                    const ttl = this.useCacheHeader === false ? this.ttl : this.parseCacheControl(headers["cache-control"]);
                    const isSkipStatus = (this.skip3xx && res.statusCode >= 300 && res.statusCode < 400) || (this.skip4xx && res.statusCode >= 400 && res.statusCode < 500) || (this.skip5xx && res.statusCode >= 500);

                    if (!isSkipStatus && ttl.maxAge) {

                        const cacheItem = {
                            ttl,
                            headers,
                            key: cacheKey,
                            status: res.statusCode,
                            body: data.toString(),
                            url: urlParsed.path
                        };
                        this.cacheProvider.set(cacheKey, JSON.stringify(cacheItem), ttl);
                    }
                    return res.endOverride(data, encoding, cb);
                };
                return next();
            }

        }).catch((err) => {
            this.emit("miss", { url: urlParsed.path });
            this.emit("cacheProviderError", err);
            return next();
        });
    }

    defaultGet(key) {
        return new Promise((resolve) => {
            resolve(this.cacheProvider.cache.get(key));
        });
    }

    defaultSet(key, item, ttl) {
        this.cacheProvider.cache.set(key, item, ttl);
    }

    //10x faster than regex
    parseCacheControl(header) {
        let options = { maxAge: 0, staleWhileRevalidate: 0 }, pos = 0, seconds = 0;
        if (header) {
            header = header.toLowerCase();
            if (header.includes("no-cache") || header.includes("no-store") || header.includes("private")) {
                return options;
            } else {
                pos = header.indexOf("max-age=");
                seconds = (pos !== -1) ? parseInt(header.substr(pos + 8), 10) : NaN;
                if (seconds >= 0) { options.maxAge = seconds; }
                pos = header.indexOf("stale-while-revalidate=");
                seconds = (pos !== -1) ? parseInt(header.substr(pos + 23), 10) : NaN;
                if (seconds >= 0) { options.staleWhileRevalidate = seconds; }
            }
        }
        return options;
    }
};