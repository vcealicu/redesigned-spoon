const scriptArgs = require('./lib/cc-config.js');
const apiCoreMs = require('./lib/cc-api-core-ms.js');
const common = require('./lib/cc-common.js');
const errorCodes = require('./lib/cc-error-codes.js');

let scriptParams = scriptArgs.parse({
    PORT: 8080,
    IP: '0.0.0.0',
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

        let postBody = {};
        try {
            postBody = JSON.parse(callParams.INTERNAL.POST_BODY);
        }
        catch (ex) {
            setImmediate(executeCallback, errorCodes.general.invalid_json_data, {}, {});
            return;
        }
        console.log(postBody);
        setImmediate(executeCallback, null, {}, {});
    }
});

apiCoreMs.start(scriptParams);
