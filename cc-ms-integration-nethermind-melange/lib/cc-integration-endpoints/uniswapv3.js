'use strict';
const errorCodes = require('../cc-error-codes.js');
const { unmappedTradeSpotModule } = require('../cc-unmapped-message');
let moduleExports = {};

moduleExports.parseBlochainData = function(postBody) {
    return unmappedTradeSpotModule.createInternalObj('uniswapv3');
};

moduleExports.exposeListeningEndpoint = {
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
        //unmappedTradeSpotModule.createInternalObj('uniswapv3', );
        setImmediate(executeCallback, null, {}, {});
    }
};

module.exports = moduleExports;
