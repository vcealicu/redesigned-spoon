'use strict';
let moduleExports = {};
moduleExports.DECIMALS = 15;
/*
fieldName:{
    RequiredInternal - true/false, used in trade validation,
    RequiredOutgoing - true/false, used in isValidComputed,
    IsComputed - true/false, used in isValidComputed,
    Type: string/number - used for trade validation,
    GreaterThan: the minimum used mostly by number and timestamp fields,
    MinLength: the minimum string length - only works for string type fields,
    AllowedValues - array of values allowed for the field,
    IsPresentInCSV - true / false used for outputing message to CSV,
    Description - the description for the field
}
*/

moduleExports.sortInternalMessagesByPrimaryAndSecondaryFields = function(internalAndExternalTradesArray, primarySortField = 'TIMESTAMP', secondarySortField = 'ID') {
    return internalAndExternalTradesArray.sort(function(prev, cur) {
        if (cur.internal_format[primarySortField] < prev.internal_format[primarySortField]) {
            return 1;
        }
        else if (cur.internal_format[primarySortField] > prev.internal_format[primarySortField]) {
            return -1;
        }
        else {
            if (cur.internal_format[secondarySortField] < prev.internal_format[secondarySortField]) {
                return 1;
            }
            else if (cur.internal_format[secondarySortField] > prev.internal_format[secondarySortField]) {
                return -1;
            }
            else {
                return 0;
            }
        }
    });
};

moduleExports.isValidFieldByType = function(messageFieldValue, currentUnmappedMessageFieldProperties) {
    if (messageFieldValue !== undefined && messageFieldValue !== null) {
        if (currentUnmappedMessageFieldProperties.AllowedValues !== undefined) {
            if (currentUnmappedMessageFieldProperties.AllowedValues.indexOf(messageFieldValue) === -1) {
                return false;
            }
        }
        if (currentUnmappedMessageFieldProperties.Type === 'string') {
            if (currentUnmappedMessageFieldProperties.MinLength !== undefined && messageFieldValue.length < currentUnmappedMessageFieldProperties.MinLength) {
                return false;
            }
        }
        else if (currentUnmappedMessageFieldProperties.Type === 'number') {
            if (isNaN(messageFieldValue)) {
                return false;
            }
            if (currentUnmappedMessageFieldProperties.GreaterThan !== undefined && messageFieldValue <= currentUnmappedMessageFieldProperties.GreaterThan) {
                return false;
            }
        }
    }
    return true;
};

moduleExports.isValid = function(messageObj, messageFieldDefinitions) {
    for (const messageObjectFieldName in messageFieldDefinitions) {
        const currentUnmappedMessageFieldProperties = messageFieldDefinitions[messageObjectFieldName];
        if (currentUnmappedMessageFieldProperties.RequiredInternal === true) {
            if (messageObj[messageObjectFieldName] === undefined || messageObj[messageObjectFieldName] === null) {
                return false;
            }
        }
        if (moduleExports.isValidFieldByType(messageObj[messageObjectFieldName], currentUnmappedMessageFieldProperties) === false) {
            return false;
        }

    }

    //update in the future.
    if (messageObj.TIMESTAMP !== undefined && messageObj.RECEIVED_TIMESTAMP !== undefined && messageObj.TIMESTAMP > messageObj.RECEIVED_TIMESTAMP) {
        return false;
    }

    return true;
};


moduleExports.isValidComputed = function(messageObj, messageFieldDefinitions) {
    for (const messageObjectFieldName in messageFieldDefinitions) {
        const currentUnmappedMessageFieldProperties = messageFieldDefinitions[messageObjectFieldName];
        if (currentUnmappedMessageFieldProperties.IsComputed === true && (currentUnmappedMessageFieldProperties.RequiredInternal === true || currentUnmappedMessageFieldProperties.RequiredOutgoing === true)) {
            if (moduleExports.isValidFieldByType(messageObj[messageObjectFieldName], currentUnmappedMessageFieldProperties) === false) {
                return false;
            }
        }
    }
    return true;
};

moduleExports.getFileHeaders = function(messageFieldDefinitions) {
    let csvHeaderString = '';
    for (const messageObjectFieldName in messageFieldDefinitions) {
        if (messageFieldDefinitions[messageObjectFieldName].IsPresentInCSV === true) {
            csvHeaderString += messageObjectFieldName + ',';
        }

    }
    if (csvHeaderString.length === 0) {
        return csvHeaderString;
    }
    return csvHeaderString.slice(0, -1);
};

// If you ever add anything to the csv row, remember to add it to the getFileHeaders function
moduleExports.convertToCSV = function(messageObject, messageFieldDefinitions) {
    let csvRowString = '';
    for (const messageObjectFieldName in messageFieldDefinitions) {
        if (messageFieldDefinitions[messageObjectFieldName].IsPresentInCSV === true) {
            csvRowString += messageObject[messageObjectFieldName] + ',';
        }

    }
    if (csvRowString.length === 0) {
        return csvRowString;
    }
    return csvRowString.slice(0, -1);
};

//this should convert floating point multiplication to a more accurate result, removes the 9999
moduleExports.multiply = function(val1, val2) {
    return parseFloat((val1 * val2).toPrecision(moduleExports.DECIMALS));
};
//this should convert floating point addition to a more accurate result, removes the 9999
moduleExports.addFloats = function(val1, val2) {
    return parseFloat((val1 + val2).toPrecision(moduleExports.DECIMALS));
};


module.exports = moduleExports;
