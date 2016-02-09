test:
	@NODE_ENV=production ./node_modules/.bin/mocha

test-w:
	@NODE_ENV=production ./node_modules/.bin/mocha \
		--growl \
		--watch

.PHONY: test test-w