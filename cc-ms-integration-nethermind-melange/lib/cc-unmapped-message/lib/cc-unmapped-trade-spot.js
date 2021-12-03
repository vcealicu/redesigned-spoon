'use strict';
const unmappedCommonModule = require('./cc-unmapped-common.js');
const staticTypes = require('../../cc-common.js').TYPE;

let moduleExports = {};
moduleExports.CAN_AGGREGATE_MESSAGE = true;
moduleExports.sortInternalMessagesByPrimaryAndSecondaryFields = unmappedCommonModule.sortInternalMessagesByPrimaryAndSecondaryFields;
moduleExports.DECIMALS = 15;
moduleExports.MESSAGE_NAME_STRING = 'TRADE_SPOT';
moduleExports.MESSAGE_NAME_STRING_PLURAL = 'TRADE_SPOT';

moduleExports.MESSAGE_AVAILABLE_FOR = {
    [staticTypes.UNMAPPED_INSTRUMENT_METADATA]: true
};

moduleExports.SIDE = {
    'SELL': 'SELL',
    'BUY': 'BUY',
    'UNKNOWN': 'UNKNOWN'
};

moduleExports.getType = function() {
    return staticTypes.UNMAPPED_INSTRUMENT_TRADE;
};

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
moduleExports.FIELDS = {
    'TYPE': {
        'RequiredInternal': true,
        'Type': 'string',
        'MinLength': 1,
        'IsPresentInCSV': true,
        'Description': 'Type of the message, this is ' + moduleExports.getType() + ' for spot trade type messages.'
    },
    'MARKET': {
        'RequiredInternal': true,
        'Type': 'string',
        'MinLength': 1,
        'IsPresentInCSV': true,
        'Description': 'The market / exchange you have requested (name of the market / exchange e.g. Coinbase, Kraken, etc.)'
    },
    'INSTRUMENT': {
        'RequiredInternal': true,
        'Type': 'string',
        'MinLength': 1,
        'IsPresentInCSV': true,
        'Description': 'The unmapped instrument id as given by the exchange (e.g. BTCUSD, BTC_USD, XBT-ZUSD, BTC-USD)'
    },
    'SIDE': {
        'RequiredInternal': true,
        'Type': 'string',
        'MinLength': 3,
        'AllowedValues': Object.keys(moduleExports.SIDE),
        'IsPresentInCSV': true,
        'Description': 'The side of the trade: SELL, BUY or UNKNOWN. We only use UNKNOWN when the underlying market / exchange API does not provide a side'
    },
    'ID': {
        'RequiredInternal': true,
        'Type': 'string',
        'MinLength': 1,
        'IsPresentInCSV': true,
        'Description': 'The trade id as reported by the market / exchange or the timestamp in seconds + 0 - 999 if they do not provide a trade id (for uniqueness under the assumption that there would not be more than 999 trades in the same second for exchanges that do not provide a trade id)'
    },
    'TIMESTAMP': {
        'RequiredInternal': true,
        'Type': 'number',
        'GreaterThan': 1230768000,
        'IsPresentInCSV': true,
        'Description': 'The timestamp in seconds as reported by the market / exchange or the received timestamp if the market / exchange does not provide one.'
    },
    'TIMESTAMP_NS': {
        'RequiredInternal': true,
        'Type': 'number',
        'IsPresentInCSV': true,
        'Description': 'The nanosecond part of the reported timestamp'
    },
    'RECEIVED_TIMESTAMP': {
        'RequiredInternal': true,
        'Type': 'number',
        'GreaterThan': 1230768000,
        'IsPresentInCSV': true,
        'Description': 'The timestamp in seconds when we received the trade. This varies from a few millisconds from the trade taking place on the market / exchange to a few seconds depending on the market / exchange API options / rate limits'
    },
    'RECEIVED_TIMESTAMP_NS': {
        'RequiredInternal': true,
        'Type': 'number',
        'IsPresentInCSV': true,
        'Description': 'The nanosecond part of the received timestamp, only available for a subset of markets / exchanges'
    },
    'QUANTITY': {
        'RequiredInternal': true,
        'Type': 'number',
        'GreaterThan': 0,
        'IsPresentInCSV': true,
        'Description': 'The from instrument (base symbol / coin/ contract) volume of the trade (for a spot BTC-USD trade, how much BTC was traded at the trade price, for a futures BTCUSDPERP this is BTC equivalent for the contracts traded)'
    },
    'PRICE': {
        'RequiredInternal': true,
        'Type': 'number',
        'GreaterThan': 0,
        'IsPresentInCSV': true,
        'Description': 'The price in the to instrument (quote / counter symbol / coin) of the trade (for a BTC-USD trade, how much was paid for one BTC in USD, for a futures this will be the price of a contract)'
    },
    'QUOTE_QUANTITY': {
        'RequiredInternal': false,
        'RequiredOutgoing': true,
        'IsComputed': true,
        'Type': 'number',
        'GreaterThan': 0,
        'IsPresentInCSV': true,
        'Description': 'The total volume in the to instrument (quote / counter symbol / coin) of the trade (it is always QUANTITY * PRICE so for a BTC-USD trade, how much USD was paid in total for the volume of BTC traded). For futures this is the quote currency quivalent for the contracts traded'
    },
    'SOURCE': {
        'RequiredInternal': false,
        'RequiredOutgoing': true,
        'Type': 'string',
        'MinLength': 1,
        'IsPresentInCSV': true,
        'Description': 'The source of the trade update: POLLING, STREAMING, GO, BLOB etc.'
    },
    'CCSEQ': {
        'RequiredInternal': false,
        'RequiredOutgoing': true,
        'Type': 'number',
        'IsPresentInCSV': true,
        'Description': 'Our internal sequence number for this trade, this is unique per market / exchange and trading pair. Should always be increasing by 1 for each new trade we discover, not in chronological order.'
    }
};

moduleExports.isInstrumentAvailableForPolling = function(currentInstrumentMetadata) {
    if (currentInstrumentMetadata.INSTRUMENT_STATUS === 'RETIRED') {
        return false;
    }
    return true;
};

moduleExports.isValid = function(messageObj) {
    return unmappedCommonModule.isValid(messageObj, moduleExports.FIELDS);
};

moduleExports.isValidComputed = function(messageObj) {
    return unmappedCommonModule.isValidComputed(messageObj, moduleExports.FIELDS);
};

moduleExports.getFileHeaders = function() {
    return unmappedCommonModule.getFileHeaders(moduleExports.FIELDS);
};

moduleExports.convertToCSV = function(messageObject) {
    return unmappedCommonModule.convertToCSV(messageObject, moduleExports.FIELDS);
};

moduleExports.pack = function(messageObject) {
    return JSON.stringify(messageObject);
};

moduleExports.unpack = function(messageString) {
    //crash on purpose, this is a councious decision
    return JSON.parse(messageString);
};

moduleExports.appendTimestampsAsIDsToSortedTradesArray = function(arrayOfSortedInternalAndExternalTrades) {
    let lastTradeTimestamp;
    let numberOfTradesAtCurrentTimestamp = 0;
    for (let trade of arrayOfSortedInternalAndExternalTrades) {
        const internalTrade = trade.internal_format;
        if (internalTrade.TIMESTAMP === lastTradeTimestamp) {
            numberOfTradesAtCurrentTimestamp++;
        }
        else {
            numberOfTradesAtCurrentTimestamp = 0;
        }
        lastTradeTimestamp = internalTrade.TIMESTAMP;
        const tradeID = internalTrade.TIMESTAMP * 10000 + numberOfTradesAtCurrentTimestamp;
        internalTrade.ID = tradeID.toString();
    }

    return arrayOfSortedInternalAndExternalTrades;
};

moduleExports.createInternalObj = function(exchangeInternalName, instrumentID, side, tradeID, executedTS, executedNS, quantity, price, receivedMS) {
    let tradeObjectToReturn = {
        TYPE: moduleExports.getType(),
        MARKET: exchangeInternalName,
        INSTRUMENT: instrumentID.toString().replace(/,|\//g, ''),
        SIDE: side,
        ID: tradeID.toString(),
        TIMESTAMP: executedTS,
        RECEIVED_TIMESTAMP: Math.floor(receivedMS / 1000),
        TIMESTAMP_NS: executedNS,
        RECEIVED_TIMESTAMP_NS: receivedMS % 1000 * 1000000,
        QUANTITY: parseFloat(quantity),
        PRICE: parseFloat(price)
    };

    return tradeObjectToReturn;
};

moduleExports.createObjComputedFields = function(messageObj) {
    let objectComputedExtraFields = {};
    objectComputedExtraFields.QUOTE_QUANTITY = unmappedCommonModule.multiply(messageObj.PRICE, messageObj.QUANTITY);
    return objectComputedExtraFields;
};

moduleExports.createOutgoingObjExtraFields = function(ccSeq, sourceType) {
    let outgoingTradeExtraFields = {};
    outgoingTradeExtraFields.SOURCE = sourceType;
    outgoingTradeExtraFields.CCSEQ = ccSeq;

    return outgoingTradeExtraFields;
};

moduleExports.getSide = function(tradeSideValue, buyValue, sellValue) {

    if (tradeSideValue === buyValue) {
        return moduleExports.SIDE.BUY;
    }

    if (tradeSideValue === sellValue) {
        return moduleExports.SIDE.SELL;
    }

    return moduleExports.SIDE.UNKNOWN;
};

moduleExports.getKeyWithParams = function(type, exchangeInternalName, instrumentID) {
    return type + '~{' + exchangeInternalName + '~' + instrumentID + '}';
};

moduleExports.getKeyFromObject = function(tradeObject) {
    return moduleExports.getKeyWithParams(tradeObject.TYPE, tradeObject.MARKET, tradeObject.INSTRUMENT);
};

moduleExports.getSubscriptionPattern = function(type, exchangeInternalName, instrumentID) {
    let subscriptionPatternToReturn = type + '~{';
    if (exchangeInternalName === undefined) {
        return subscriptionPatternToReturn + '*';
    }

    subscriptionPatternToReturn += exchangeInternalName + '~';
    if (instrumentID === undefined) {
        return subscriptionPatternToReturn + '*';
    }

    return subscriptionPatternToReturn + instrumentID + '}';
};

moduleExports.getSubscriptionKey = function(exchangeInternalName, instrumentID) {
    return moduleExports.getSubscriptionPattern(moduleExports.getType(), exchangeInternalName, instrumentID);
};

moduleExports.getHistoType = function() {
    return staticTypes.UNMAPPED_INSTRUMENT_HISTO_DATA;
};

moduleExports.getTickType = function() {
    return staticTypes.UNMAPPED_INSTRUMENT_MARKET_DATA;
};

moduleExports.getInstrumentMetadataType = function() {
    return staticTypes.UNMAPPED_INSTRUMENT_METADATA;
};

moduleExports.getQueueName = function() {
    return moduleExports.MESSAGE_NAME_STRING_PLURAL + '~OUTPUT_QUEUE';
};

module.exports = moduleExports;
