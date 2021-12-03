'use strict';
const urlModule = require('url');
const appHttp = require('http');
const appHttps = require('https');
const memoryCache = new(require('./cc-memory-cache-with-queue.js'))(600);
const common = require('./cc-common.js');
const errorCodes = require('./cc-error-codes.js');

const responseTypes = {
    ok: 200,
    notFound: 404,
    notAuthorized: 401,
    notAcceptable: 406,
    rateLimit: 429
};

const responseBaseObject = {
    Response: 'Success',
    Message: '',
    Type: 100,
    Data: {}
};
const pathNotFoundError = {
    Response: 'Error',
    Message: 'Path does not exist.',
    Type: 0,
    Data: {}
};
const httpVerbNotAllowed = {
    Response: 'Error',
    Message: 'We only support GET as the http request type.',
    Type: 0,
    Data: {}
};

const httpMoreRequestsNotAllowed = {
    Response: 'Error',
    Message: 'You can only have 1 request in flight at a time',
    Type: 0,
    Data: {}
};

const invalidAuthKeyErrorObj = {
    Response: 'Error',
    Message: 'You need a valid auth key or api key to access this endpoint.',
    Type: 1,
    Data: {}
};


let allEndpoints = [];
let serverForApi = {};
let scriptParams = {};

serverForApi.getInfoFromRequest = function(request) {
    let callParams = { INTERNAL: {} };
    let urlObj = new urlModule.URL(request.url, `http://${request.headers.host}`);
    let currentClientIp = request.headers['x-real-ip'] || request.headers['x-forwarded-for'] || request.connection.remoteAddress;
    callParams.INTERNAL.HEADERS = request.headers;

    //copy over the getParams to callParams
    for (const [getParamName, getParamValue] of urlObj.searchParams) {
        if (getParamName === 'INTERNAL') { continue; }
        callParams[getParamName] = getParamValue;
    }
    return { urlObj, callParams, currentClientIp };
};


serverForApi.handleRequest = function(request, response) {

    let { urlObj, callParams, currentClientIp } = serverForApi.getInfoFromRequest(request);

    if (request.method === 'OPTIONS') {
        serverForApi.sendResponse(response, {}, 'application/json', { shouldCache: true }, currentClientIp, responseTypes.ok);
        return;
    }
    if (request.method === 'GET') {
        serverForApi.routeRequestAndRespond(request.method, response, urlObj.pathname, callParams, currentClientIp);
        return;
    }
    if (request.method == 'POST' || request.method == 'PUT') {
        let body = '';
        request.on('data', function(data) {
            body += data;

            // Too much POST data, kill the connection!
            // 2e6 === 2 * Math.pow(10, 6) === 2 * 1000000 ~~~ 2MB this is for the avatar upload
            if (body.length > 2e6) {
                request.connection.destroy();
            }
        });
        request.on('end', function() {
            callParams.INTERNAL.POST_BODY = body;
            serverForApi.routeRequestAndRespond(request.method, response, urlObj.pathname, callParams, currentClientIp);
        });
        return;
    }

    serverForApi.sendResponse(response, httpVerbNotAllowed, 'application/json', { shouldCache: true }, currentClientIp, responseTypes.notAcceptable);
};

serverForApi.doesUserHaveAccess = function(permittedRoles, parsedResponse) {
    /* Does the endpoint have no restriction? */
    if (permittedRoles.length === 0) {
        return true;
    }
    if (parsedResponse === undefined || parsedResponse.Data === undefined ||
        parsedResponse.Data.general === undefined || parsedResponse.Data.general.roles === undefined) {
        return false;
    }
    for (let i = 0; i < permittedRoles.length; i++) {
        if (parsedResponse.Data.general.roles.indexOf(permittedRoles[i]) > -1) {
            return true;
        }
    }
    return false;
};

serverForApi.getUserDataFromAuthAPI = function(apiKey, getUserDataFromAuthAPICallback) {
    if (apiKey === undefined || apiKey === '') {
        common.LOG.toConsole(`Error whilst making an Auth-API request, no api key`, common.LOG.ERROR, scriptParams.LOG_LEVEL);
        let errorDataForCache = { message: errorCodes.api.internal_api_call, responseType: responseTypes.notAcceptable };
        setImmediate(getUserDataFromAuthAPICallback, errorDataForCache, {});
        return;
    }
    const postData = JSON.stringify({ api_key: apiKey, user_info_sections: ['general', 'subscription'] });
    const urlObj = new urlModule.URL('/cryptopian/get', scriptParams.AUTH_API_URL);
    const options = {
        host: urlObj.hostname,
        path: urlObj.pathname,
        port: urlObj.port,
        protocol: urlObj.protocol,
        method: 'POST',
        headers: {
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    let requestModule = appHttps;
    if (scriptParams.AUTH_API_URL.startsWith('http://')) {
        requestModule = appHttp;
    }

    /* Attempt to retrieve data associated to the provided authKey */
    const authApiResponse = requestModule.request(options, function(responseInfo) {
        //did not get a response at all
        if (responseInfo === undefined || responseInfo === null) {
            common.LOG.toConsole(`Error whilst making an Auth-API request to ${options}, no response`, common.LOG.ERROR, scriptParams.LOG_LEVEL);
            let errorDataForCache = { message: errorCodes.api.internal_api_call, responseType: responseTypes.notAcceptable };
            getUserDataFromAuthAPICallback(errorDataForCache, {});
            return;
        }
        //got not authorized status code
        if (responseInfo.statusCode === responseTypes.notAuthorized) {
            common.LOG.toConsole(`Error whilst making an Auth-API request to ${options}, not authorized`, common.LOG.ERROR, scriptParams.LOG_LEVEL);
            let errorDataForCache = { message: invalidAuthKeyErrorObj, responseType: responseTypes.notAuthorized };
            getUserDataFromAuthAPICallback(errorDataForCache, {});
            return;
        }

        //got the wrong status code or did not receive any data from the server
        if (responseInfo.statusCode !== responseTypes.ok) {
            common.LOG.toConsole(`Error whilst making an Auth-API request to ${options}, not ok`, common.LOG.ERROR, scriptParams.LOG_LEVEL);
            let errorDataForCache = { message: errorCodes.api.internal_api_call, responseType: responseTypes.notAcceptable };
            getUserDataFromAuthAPICallback(errorDataForCache, {});
            return;
        }

        responseInfo.setEncoding('utf8');
        let responseData = '';
        responseInfo.on('data', function(chunk) {
            responseData += chunk;
        });
        responseInfo.on('end', function() {
            if (responseData === '') {
                common.LOG.toConsole(`Error whilst making an Auth-API request to ${options}, no data`, common.LOG.ERROR, scriptParams.LOG_LEVEL);
                let errorDataForCache = { message: errorCodes.api.internal_api_call, responseType: responseTypes.notAcceptable };
                getUserDataFromAuthAPICallback(errorDataForCache, {});
                return;
            }

            let parsedResponse = {};
            try {
                parsedResponse = JSON.parse(responseData);
            }
            catch (ex) {
                //got wrong json formatted response
                common.LOG.toConsole(`Error whilst making an Auth-API request to ${options}, JSON error`, common.LOG.ERROR, scriptParams.LOG_LEVEL);
                let errorDataForCache = { message: errorCodes.api.internal_api_call, responseType: responseTypes.notAcceptable };
                getUserDataFromAuthAPICallback(errorDataForCache, {});
                return;
            }

            getUserDataFromAuthAPICallback(null, parsedResponse);
        });
    });

    authApiResponse.on('error', function(error) {
        common.LOG.toConsole(`Error whilst making an Auth-API request to ${options} with error: ${error}`, common.LOG.ERROR, scriptParams.LOG_LEVEL);
        let errorDataForCache = { message: errorCodes.api.internal_api_call, responseType: responseTypes.notAcceptable };
        getUserDataFromAuthAPICallback(errorDataForCache, {});
    });

    authApiResponse.write(postData);

    authApiResponse.end();
};

serverForApi.retrieveAndValidateUser = function(apiKey, endpointToExecute, hitTimestamp, retrieveAndValidateUserCallback) {
    //retrieveAndValidateUserCallback(errResponseObj, errorResponseType, userObject)
    let cacheKey = 'user_' + apiKey;
    memoryCache.getDataWithCache(cacheKey, hitTimestamp, function(gotDataCallback) {
        serverForApi.getUserDataFromAuthAPI(apiKey, gotDataCallback);
    }, function(errGettingData, cacheHit, data) {
        if (errGettingData !== false) {
            retrieveAndValidateUserCallback(errGettingData.message, errGettingData.responseType, data);
            return;
        }

        /* Is this endpoint restricted by role? */
        let hasAccess = serverForApi.doesUserHaveAccess(endpointToExecute.PermittedRoles, data);
        if (hasAccess === false) {
            retrieveAndValidateUserCallback(invalidAuthKeyErrorObj, responseTypes.notAuthorized, data);
            return;
        }

        retrieveAndValidateUserCallback(null, responseTypes.ok, data);
    });

};

serverForApi.routeRequestAndRespond = function(requestMethod, response, currentPath, callParams, currentClientIp) {
    let endpointToExecute = allEndpoints.find(function(pathToCheck) { return pathToCheck.Url === currentPath; });
    if (endpointToExecute === undefined || endpointToExecute.HttpVerb !== requestMethod) {
        serverForApi.sendResponse(response, pathNotFoundError, 'application/json', { shouldCache: true }, currentClientIp, responseTypes.notFound);
        return;
    }

    let hitTimestamp = Math.floor(new Date().getTime() / 1000);

    if (callParams.api_key === undefined || callParams.api_key === '') {
        if (endpointToExecute.PermittedRoles.length > 0) {
            serverForApi.sendResponse(response, invalidAuthKeyErrorObj, responseTypes.notAuthorized);
            return;
        }
        else {
            endpointToExecute.execute(callParams, hitTimestamp, function(err, responseData, options) {
                if (err) {
                    const responseToSend = Object.assign({}, responseBaseObject);
                    responseToSend.Response = "Error";
                    if (err.frontend !== undefined) {
                        if (err.frontend.message !== undefined) {
                            responseToSend.Message = err.frontend.message;
                        }
                        if (err.frontend.type !== undefined) {
                            responseToSend.Type = err.frontend.type;
                        }
                    }
                    serverForApi.sendResponse(response, responseToSend, 'application/json', options, currentClientIp, responseTypes.notAcceptable);
                    return;
                }
                serverForApi.sendResponse(response, responseData, endpointToExecute.ResponseType, options, currentClientIp, responseTypes.ok);
            });
            return;
        }
    }
    serverForApi.retrieveAndValidateUser(callParams.api_key, endpointToExecute, hitTimestamp, function(errResponseObj, errorResponseType, userGeneralAndSubscriptionData) {
        if (errResponseObj) {
            serverForApi.sendResponse(response, errResponseObj, errorResponseType);
            return;
        }

        endpointToExecute.execute(callParams, hitTimestamp, function(err, responseData, options) {
            if (err) {
                const responseToSend = Object.assign({}, responseBaseObject);
                responseToSend.Response = "Error";
                if (err.frontend !== undefined) {
                    if (err.frontend.message !== undefined) {
                        responseToSend.Message = err.frontend.message;
                    }
                    if (err.frontend.type !== undefined) {
                        responseToSend.Type = err.frontend.type;
                    }
                }
                serverForApi.sendResponse(response, responseToSend, 'application/json', options, currentClientIp, responseTypes.notAcceptable);
                return;
            }
            serverForApi.sendResponse(response, responseData, endpointToExecute.ResponseType, options, currentClientIp, responseTypes.ok);
        });
    });

};

serverForApi.sendResponse = function(response, responseData, responseContentType, options, currentClientIp, statusCode) {
    response.setHeader('Content-Security-Policy', 'frame-ancestors \'none\'');
    response.setHeader('X-Robots-Tag', 'noindex');
    if (options.shouldCache === true) {
        response.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
    if (responseContentType === 'image/png') {
        response.setHeader('Content-Disposition', 'inline; filename="' + options.filename + '"');
        response.writeHead(statusCode, { 'Content-Type': responseContentType });
        response.end(responseData);
    }
    else {
        response.writeHead(statusCode, { 'Content-Type': responseContentType });
        response.end(JSON.stringify(responseData));
    }
};

serverForApi.addEndpoint = function(newEndpoint) {
    let existingEndpoint = allEndpoints.find(function(endpoint) { return endpoint.Url === newEndpoint.Url });
    if (existingEndpoint !== undefined) {
        console.log('Path: ' + newEndpoint.Url + ' is defined in Endpoint ' + existingEndpoint.Key + ' and in Endpoint ' + newEndpoint.Key);
        process.exit(1);
    }
    allEndpoints.push(newEndpoint);
};

serverForApi.start = function(externalScriptParams, socketServer) {
    scriptParams = externalScriptParams;
    if (scriptParams.AUTH_API_URL === undefined || scriptParams.AUTH_API_URL === '') {
        common.LOG.toConsole('The scriptParams AUTH_API_URL for the miniCore service to start', common.LOG.WARNING, scriptParams.LOG_LEVEL);
        return;
    }
    let scriptParamsSanitizedForOutput = {};
    for (let currentScriptParamName in externalScriptParams) {
        scriptParamsSanitizedForOutput[currentScriptParamName] = externalScriptParams[currentScriptParamName];
        if (currentScriptParamName.match(/CONNECTION_STRING/i)) {
            scriptParamsSanitizedForOutput[currentScriptParamName] = scriptParamsSanitizedForOutput[currentScriptParamName].replace(/\/\/(.*)@/g, '//*******@');
        }
        if (currentScriptParamName.match(/_KEY/i)) {
            scriptParamsSanitizedForOutput[currentScriptParamName] = '*******';
        }
        if (currentScriptParamName.match(/_SECRET/i)) {
            scriptParamsSanitizedForOutput[currentScriptParamName] = '*******';
        }
    }
    console.log('Params are ' + JSON.stringify(scriptParamsSanitizedForOutput));
    let currentHttpServer = appHttp.createServer(serverForApi.handleRequest).listen(externalScriptParams.PORT, externalScriptParams.IP);
    if (socketServer !== undefined) {
        currentHttpServer.on('upgrade', function(request, socket, head) {
            let requestInfo = serverForApi.getInfoFromRequest(request);
            socketServer.handleUpgrade(request, socket, head, function done(ws) {
                socketServer.emit('connection', ws, request, requestInfo);
            });
        });
    }
    return currentHttpServer;
};

module.exports = serverForApi;
