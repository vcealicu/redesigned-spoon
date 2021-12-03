'use strict';
let moduleExports = {};

moduleExports.api = {
    service_temporarily_unavailable: {
        type: 94,
        message: 'Due to unforseen circumstances the service is temporarily unavailable. Please try again later.',
        frontend: {
            type: 94,
            message: 'Due to unforseen circumstances the service is temporarily unavailable. Please try again later.'
        }
    },
    path_unavailable: {
        type: 95,
        message: 'Path unavailable',
        frontend: {
            type: 95,
            message: 'Path currently unavailable, please try again later.'
        }
    },
    cannot_retrieve_data: {
        type: 96,
        message: 'Could not retrieve data',
        frontend: {
            type: 96,
            message: 'Unable to retrieve requested data at this time, please try again later.'
        }
    },
    rate_limit: {
        type: 99,
        message: 'Rate limit excedeed!',
        frontend: {
            type: 99,
            message: 'Rate limit excedeed!'
        }
    },
    rate_limit_soft_cap: {
        type: 101,
        message: 'Rate limit excedeed!',
        frontend: {
            type: 101,
            message: 'Rate limit excedeed!'
        }
    },
    external_api_call: {
        type: 102,
        message: 'Error calling external API',
        frontend: {
            type: 102,
            message: 'General error try again later'
        }
    },
    internal_api_call: {
        type: 103,
        message: 'Error calling internal API',
        frontend: {
            type: 103,
            message: 'General error try again later'
        }
    },
    api_or_auth_key_missing: {
        type: 401,
        message: 'You need a valid auth key or api key to access this endpoint / params combination',
        frontend: {
            type: 1,
            message: 'You need a valid auth key or api key to access this endpoint / params combination'
        }
    }
};

module.exports = moduleExports;
