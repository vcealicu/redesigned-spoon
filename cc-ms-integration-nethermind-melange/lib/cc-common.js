'use strict';
let logDataForAggregation = {};
let moduleExports = {};
moduleExports.LOG = {
    'INFO': 1,
    'WARNING': 2,
    'ERROR': 3,
    'LOG_AGGREGATION_SECONDS': 0,
    getLogLevel: function() {
        return process.env.LOG_LEVEL || moduleExports.LOG.WARNING;
    },
    setAggregationInSeconds: function(totalSecondsToAggregate) {
        moduleExports.LOG.LOG_AGGREGATION_SECONDS = totalSecondsToAggregate;
    },
    toConsole: function(message, messageLevel, currentLevel, paramsObj) {
        if (messageLevel >= currentLevel) {
            let messageToLog = '';
            let currentDateAsString = (new Date()).toString();
            if (paramsObj !== undefined) {
                messageToLog = message + ' - ' + JSON.stringify(paramsObj);
            } else {
                messageToLog = message;
            }
            if (moduleExports.LOG.LOG_AGGREGATION_SECONDS === 0) {
                console.log(currentDateAsString + ' : ' + messageToLog);
            } else {
                if (logDataForAggregation[messageToLog] === undefined) {
                    logDataForAggregation[messageToLog] = {
                        firstSeen: currentDateAsString,
                        lastSeen: currentDateAsString,
                        message: messageToLog,
                        occurance: 1
                    };
                    setTimeout(function() {
                        let aggregatedMessage = logDataForAggregation[messageToLog];
                        console.log(aggregatedMessage.firstSeen + ' - ' + aggregatedMessage.lastSeen + ' : ' + messageToLog + '(' + aggregatedMessage.occurance + ')');
                        logDataForAggregation[messageToLog] = undefined;
                    }, moduleExports.LOG.LOG_AGGREGATION_SECONDS * 1000);
                } else {
                    logDataForAggregation[messageToLog].occurance++;
                    logDataForAggregation[messageToLog].lastSeen = currentDateAsString;
                }
            }
        }
    },
    toSlack: function(message, messageLevel, currentLevel, paramsObj) {
        if (messageLevel < currentLevel) {
            return;
        }
        if (paramsObj === undefined) {
            console.log((new Date()).toString() + ' : You need to pass an object with name, request module and url and optionally a callbackFunction');
            return;
        }
        if (paramsObj.name === undefined) {
            console.log((new Date()).toString() + ' : You need to add a name param');
            return;
        }
        if (paramsObj.request === undefined) {
            console.log((new Date()).toString() + ' : You need to add a request module param');
            return;
        }
        if (paramsObj.url === undefined) {
            console.log((new Date()).toString() + ' : You need to add a url param');
            return;
        }
        let typeOfMessage = 'good';
        if (moduleExports.LOG.WARNING === messageLevel) {
            typeOfMessage = 'warning';
        } else if (moduleExports.LOG.ERROR === messageLevel) {
            typeOfMessage = 'danger';
        }
        let thingToSend = {
            'fallback': 'Script - ' + paramsObj.name + ' - ' + typeOfMessage,
            'color': typeOfMessage,
            'fields': [{
                'title': paramsObj.name + ' - ' + typeOfMessage,
                'value': message,
                'short': false
            }]
        };
        paramsObj.request({
            url: paramsObj.url,
            method: 'POST',
            json: thingToSend,
        }, function(error, response, body) {
            if (paramsObj.callbackFunction !== undefined) {
                paramsObj.callbackFunction();
            }
        });
    }
};

module.exports = moduleExports;
