const scriptArgs = require('./lib/cc-config.js');
const apiCoreMs = require('./lib/cc-api-core-ms.js');

let scriptParams = scriptArgs.parse({
    PORT: 8080,
    IP: '0.0.0.0',
});


apiCoreMs.addEndpoint({
    CacheLength: 0,
    HttpVerb: 'GET',
    Key: 'uniswapv3',
    Url: '/uniswap/v3',
    Description: '',
    Examples: [],
    ResponseType:'application/json',
    execute: function(callParams, hitTimestamp, executeCallback) {
        console.log(callParams);
       executeCallback()
    }
});

apiCoreMs.start(scriptParams);