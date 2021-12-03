const scriptArgs = require('./lib/cc-config.js');
const apiCoreMs = require('./lib/cc-api-core-ms.js');
const common = require('./lib/cc-common.js');

let scriptParams = scriptArgs.parse({
    PORT: 8080,
    IP: '172.31.36.75',
    LOG_LEVEL: common.LOG.WARNING,
    AUTH_API_URL: 'https://auth-api.cryptocompare.com/'
});


apiCoreMs.addEndpoint({
    CacheLength: 0,
    HttpVerb: 'POST',
    Key: 'uniswapv3',
    Url: '/uniswap/v3',
    Description: '',
    Examples: [],
    ResponseType: 'application/json',
    PermittedRoles: ['news_partner'],
    execute: function(callParams, hitTimestamp, executeCallback) {
        console.log(callParams);
        setImmediate(executeCallback, null, {}, {});
    }
});

apiCoreMs.start(scriptParams);
