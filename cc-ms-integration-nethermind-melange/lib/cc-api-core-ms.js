'use strict';
const urlModule = require('url');
const appHttp = require('http');

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

let allEndpoints = [];
let serverForApi = {};
let requestsInFlight ={};

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
    console.log(request.url);
    return { urlObj, callParams, currentClientIp };
};

serverForApi.handleRequest = function(request, response) {
    let { urlObj, callParams, currentClientIp } = serverForApi.getInfoFromRequest(request);
    if(requestsInFlight[currentClientIp] === undefined){
        requestsInFlight[currentClientIp] = 1;
    } else {
        requestsInFlight[currentClientIp]++;
        serverForApi.sendResponse(response, httpMoreRequestsNotAllowed, 'application/json', '', true, currentClientIp, responseTypes.notAcceptable);
        return;
    }
    
    if (request.method === 'OPTIONS') {
        serverForApi.sendResponse(response, {}, 'application/json', '', true, currentClientIp, responseTypes.ok);
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

    serverForApi.sendResponse(response, httpVerbNotAllowed, 'application/json', '', true, currentClientIp, responseTypes.notAcceptable);
};

serverForApi.routeRequestAndRespond = function(requestMethod, response, currentPath, callParams, currentClientIp) {
    let endpointToExecute = allEndpoints.find(function(pathToCheck) { return pathToCheck.Url === currentPath; });
    if (endpointToExecute === undefined || endpointToExecute.HttpVerb !== requestMethod) {
        serverForApi.sendResponse(response, pathNotFoundError, 'application/json', '', true, currentClientIp, responseTypes.notFound);
        return;
    }

    let hitTimestamp = Math.floor(new Date().getTime() / 1000);

    endpointToExecute.execute(callParams, hitTimestamp, function(err, responseData, fileName, shouldCache) {
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
            serverForApi.sendResponse(response, responseToSend, 'application/json', fileName, true, currentClientIp, responseTypes.notAcceptable);
            return;
        }
        serverForApi.sendResponse(response, responseData, 'image/png', fileName, shouldCache, currentClientIp, responseTypes.ok);
    });

};

serverForApi.sendResponse = function(response, responseData, responseContentType, fileName, shouldCache, currentClientIp, statusCode) {
    requestsInFlight[currentClientIp]--;
    if(requestsInFlight[currentClientIp] === 0){
        delete requestsInFlight[currentClientIp];
    }
    response.setHeader('Content-Security-Policy', 'frame-ancestors \'none\'');
    response.setHeader('X-Robots-Tag', 'noindex');
    if(shouldCache){
        response.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
    if (responseContentType === 'image/png') {
        response.setHeader('Content-Disposition', 'inline; filename="' + fileName + '"');
        response.writeHead(statusCode, { 'Content-Type': responseContentType });
        response.end(responseData);
    } else {
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