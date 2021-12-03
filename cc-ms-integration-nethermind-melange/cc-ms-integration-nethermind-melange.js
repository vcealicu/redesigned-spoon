const scriptArgs = require('./lib/cc-config.js');
const apiCoreMs = require('./lib/cc-api-core-ms.js');
const common = require('./lib/cc-common.js');
const uniswapv3 = require('./lib/cc-integration-endpoints/uniswapv3.js');

let scriptParams = scriptArgs.parse({
    PORT: 8080,
    IP: '172.31.36.75',
    LOG_LEVEL: common.LOG.WARNING,
    AUTH_API_URL: 'https://auth-api.cryptocompare.com/'
});

apiCoreMs.addEndpoint(uniswapv3.exposeListeningEndpoint);

apiCoreMs.start(scriptParams);
