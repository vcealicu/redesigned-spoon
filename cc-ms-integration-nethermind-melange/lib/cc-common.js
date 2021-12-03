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
            }
            else {
                messageToLog = message;
            }
            if (moduleExports.LOG.LOG_AGGREGATION_SECONDS === 0) {
                console.log(currentDateAsString + ' : ' + messageToLog);
            }
            else {
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
                }
                else {
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
        }
        else if (moduleExports.LOG.ERROR === messageLevel) {
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

moduleExports.TYPE = {
    /*
    Only global redis.
    Redis key structure
        200~exchange~integrations. smembers
    */
    'FUTURES_EXCHANGE_INTERNAL_NAMES': '200',
    /*
    Redis key structure 202~{[exchange_internal_name]}.
        E.g.
            202~{deribit}. smembers
    */
    'FUTURES_UNMAPPED_INSTRUMENTS': '202',
    /*
    Redis key structure 203~{[exchange_internal_name]}~[instrument_id].
        E.g.
            203~{deribit}~BTC-PERPETUAL. hgetall
    */
    'FUTURES_UNMAPPED_INSTRUMENT_METADATA': '203',
    /*
    No redis keys
    Local redis publish under the redis key
        TRADES_FUTURES~OUTPUT_QUEUE. lpush
    Saved in files - trades/cc-ms-message-output/[exchange_internal_name]/[instrument_id]/[hour_time].csv
        E.g.
            trades/cc-ms-message-output/deribit/BTC-PERPETUAL/2017-08-20-18-00-00.csv
    Streaming key structure 204~{[exchange_internal_name]~[instrument_id]}.
        E.g.
            204~{deribit~BTC-PERPETUAL}
            subscribe 204~{deribit~BTC-PERPETUAL} for BTC-PERPETUAL on deribit
    */
    'FUTURES_UNMAPPED_INSTRUMENT_TRADE': '204',
    /*
    Redis key structure 205~{[exchange_internal_name]}~[instrument_id]
        E.g.
            205~{deribit}~BTC-PERPETUAL. zcard, zrange, zrevrange, zadd
    Only local redis and no streaming, used for trades deduplicate
    */
    'FUTURES_UNMAPPED_INSTRUMENT_LATEST_TRADES_METADATA': '205',
    /*
    Redis key structure 206~{[exchange_internal_name]~[instrument_id]}
        E.g.
            706~{deribit~BTC-PERPETUAL}. hgetall
    Streaming key structure 706~{[exchange_internal_name]~[instrument_id]}
        E.g.
            706~{deribit~BTC-PERPETUAL}
            subscribe 706~{deribit~BTC-PERPETUAL} for BTC-PERPETUAL on deribit
    */
    'FUTURES_UNMAPPED_INSTRUMENT_MARKET_DATA': '206',
    /*
    Redis key structure 207~{[exchange_internal_name]~[instrument_id]}~[unitName]~[bucketName].
        E.g.
            207~{deribit~BTC-PERPETUAL}~MINUTE~FIRST_BUCKET. hget
            207~{deribit~BTC-PERPETUAL}~MINUTE~BUCKETS_CACHE. hgetall
            207~{deribit~BTC-PERPETUAL}~MINUTE~LAST_BUCKET. hget
    Streaming key structure 207~{[exchange_internal_name]~[instrument_id]}~[unitName].
        E.g.
            207~{deribit~BTC-PERPETUAL}~MINUTE
            subscribe 207~{deribit~BTC-PERPETUAL}~MINUTE for just minute data for BTC-PERPETUAL on deribit
    */
    'FUTURES_UNMAPPED_INSTRUMENT_HISTO_DATA': '207',

    /*

        Redis key structure
        208~{[exchange_internal_name]~[instrument_id]}~INFO
        208~{[exchange_internal_name]~[instrument_id]}~[side].
            E.g.
            208~{coinbase~BTC-USD}~INFO - hgetall - CCSEQ, BID_DEPTH, ASK_DEPTH, LAST_UPDATE etc
            208~{coinbase~BTC-USD}~BID - hgetall - PRICE:QUNATITY
            208~{coinbase~BTC-USD}~ASK - hgetall - PRICE:QUNATITY
        Redis key structure 208~{[exchange_internal_name]~[instrument_id]}.
            E.g.
               subscribe 208~{coinbase~BTC-USD}  TIMESTAMP, TIMESTAMP_NS, RECEIVED_TIMESTAMP, RECEIVED_TIMESTAMP_NS, SIDE, ACTION, PRICE, QUNATITY, SOURCE, CCSEQ
        */
    'FUTURES_UNMAPPED_ORDERBOOK_UPDATE_DATA': '208',
    'FUTURES_UNMAPPED_ORDERBOOK_SNAPSHOT_DATA': '298',


    /*

    Redis key structure
    209~{[exchange_internal_name]~[instrument_id]}~INFO
    209~{[exchange_internal_name]~[instrument_id]}~[side].
        E.g.
        209~{coinbase~BTC-USD}~INFO - hgetall - CCSEQ, LAST_UPDATE etc
        209~{coinbase~BTC-USD}~BID - hgetall - TIMESTAMP, TIMESTAMP_NS, RECEIVED_TIMESTAMP, RECEIVED_TIMESTAMP_NS, SIDE, ACTION, PRICE, QUNATITY, SOURCE, CCSEQ
        209~{coinbase~BTC-USD}~ASK - hgetall - TIMESTAMP, TIMESTAMP_NS, RECEIVED_TIMESTAMP, RECEIVED_TIMESTAMP_NS, SIDE, ACTION, PRICE, QUNATITY, SOURCE, CCSEQ
    Streaming key structure 209~{[exchange_internal_name]~[instrument_id]}
        E.g.
           subscribe 209~{coinbase~BTC-USD} - TIMESTAMP, TIMESTAMP_NS, RECEIVED_TIMESTAMP, RECEIVED_TIMESTAMP_NS, SIDE, ACTION, PRICE, QUNATITY, SOURCE, CCSEQ
    */
    'FUTURES_UNMAPPED_ORDERBOOK_TOP_OF_BOOK_DATA': '209',
    'FUTURES_UNMAPPED_ORDERBOOK_TOP_OF_BOOK_SNAPSHOT': '299',

    /*
    Redis key structure 212~{[exchange_internal_name]}.
        E.g.
            212~{deribit}. smembers
    */
    'INDICES_UNMAPPED_INSTRUMENTS': '212',
    /*
    Redis key structure 213~{[exchange_internal_name]}~[index_id].
        E.g.
            213~{deribit}~BTC-PERPETUAL. hgetall
    */
    'INDEX_UNMAPPED_INSTRUMENT_METADATA': '213',
    /*
    No redis keys
    Local redis publish under the redis key
        INDEX_UPDATES~OUTPUT_QUEUE. lpush
    Saved in files - trades/cc-ms-message-output/[exchange_internal_name]/[index_id]/[hour_time].csv
        E.g.
            trades/cc-ms-message-output/deribit/BTC-PERPETUAL/2017-08-20-18-00-00.csv
    Streaming key structure 214~{[exchange_internal_name]~[index_id]}.
        E.g.
            214~{deribit~BTC-PERPETUAL}
            subscribe 214~{deribit~BTC-PERPETUAL} for BTC-PERPETUAL index on deribit
    */
    'INDEX_UNMAPPED_INSTRUMENT_UPDATE': '214',
    /*
    Redis key structure 215~{[exchange_internal_name]}~[index_id]
        E.g.
            215~{deribit}~BTC-PERPETUAL. zcard, zrange, zrevrange, zadd
    Only local redis and no streaming, used for index update deduplicate
    */
    'INDEX_UNMAPPED_INSTRUMENT_LATEST_UPDATES_METADATA': '215',
    /*
    Redis key structure 216~{[exchange_internal_name]~[index_id]}
        E.g.
            216~{deribit~BTC-PERPETUAL}. hgetall
    Streaming key structure 216~{[exchange_internal_name]~[index_id]}
        E.g.
            216~{deribit~BTC-PERPETUAL}
            subscribe 216~{deribit~BTC-PERPETUAL} for BTC-PERPETUAL index on deribit
    */
    'INDEX_UNMAPPED_INSTRUMENT_MARKET_DATA': '216',
    /*
    Redis key structure 217~{[exchange_internal_name]~[index_id]}~[unitName]~[bucketName].
        E.g.
            217~{deribit~BTC-PERPETUAL}~MINUTE~FIRST_BUCKET. hget
            217~{deribit~BTC-PERPETUAL}~MINUTE~BUCKETS_CACHE. hgetall
            217~{deribit~BTC-PERPETUAL}~MINUTE~LAST_BUCKET. hget
    Streaming key structure 217~{[exchange_internal_name]~[index_id]}~[unitName].
        E.g.
            217~{deribit~BTC-PERPETUAL}~MINUTE
            subscribe 217~{deribit~BTC-PERPETUAL}~MINUTE for just minute data for BTC-PERPETUAL index on deribit
    */
    'INDEX_UNMAPPED_INSTRUMENT_HISTO_DATA': '217',


    /*
    No redis keys
    Local redis publish under the redis key
        FUNDING_RATE_UPDATES~OUTPUT_QUEUE. lpush
    Saved in files - trades/cc-ms-message-output/[exchange_internal_name]/[instrument_id]/[hour_time].csv
        E.g.
            trades/cc-ms-message-output/deribit/BTC-PERPETUAL/2017-08-20-18-00-00.csv
    Streaming key structure 224~{[exchange_internal_name]~[instrument_id]}.
        E.g.
            224~{deribit~BTC-PERPETUAL}
            subscribe 224~{deribit~BTC-PERPETUAL} for BTC-PERPETUAL funding rate on deribit
    */
    'FUNDING_RATE_UNMAPPED_INSTRUMENT_UPDATE': '224',
    /*
    Redis key structure 225~{[exchange_internal_name]}~[instrument_id]
        E.g.
            225~{deribit}~BTC-PERPETUAL. zcard, zrange, zrevrange, zadd
    Only local redis and no streaming, used for funding rate tick deduplicate
    */
    'FUNDING_RATE_UNMAPPED_INSTRUMENT_LATEST_UPDATES_METADATA': '225',
    /*
    Redis key structure 226~{[exchange_internal_name]~[instrument_id]}
        E.g.
            226~{deribit~BTC-PERPETUAL}. hgetall
    Streaming key structure 226~{[exchange_internal_name]~[instrument_id]}
        E.g.
            226~{deribit~BTC-PERPETUAL}
            subscribe 226~{deribit~BTC-PERPETUAL} for BTC-PERPETUAL funding rate on deribit
    */
    'FUNDING_RATE_UNMAPPED_INSTRUMENT_MARKET_DATA': '226',
    /*
    Redis key structure 227~{[exchange_internal_name]~[instrument_id]}~[unitName]~[bucketName].
        E.g.
            227~{deribit~BTC-PERPETUAL}~MINUTE~FIRST_BUCKET. hget
            227~{deribit~BTC-PERPETUAL}~MINUTE~BUCKETS_CACHE. hgetall
            227~{deribit~BTC-PERPETUAL}~MINUTE~LAST_BUCKET. hget
    Streaming key structure 227~{[exchange_internal_name]~[instrument_id]}~[unitName].
        E.g.
            227~{deribit~BTC-PERPETUAL}~MINUTE
            subscribe 227~{deribit~BTC-PERPETUAL}~MINUTE for just minute data for BTC-PERPETUAL funding rate on deribit
    */
    'FUNDING_RATE_UNMAPPED_INSTRUMENT_HISTO_DATA': '227',



    /*
    No redis keys
    Local redis publish under the redis key
        OPEN_INTEREST_UPDATES~OUTPUT_QUEUE. lpush
    Saved in files - trades/cc-ms-message-output/[exchange_internal_name]/[instrument_id]/[hour_time].csv
        E.g.
            trades/cc-ms-message-output/deribit/BTC-PERPETUAL/2017-08-20-18-00-00.csv
    Streaming key structure 234~{[exchange_internal_name]~[instrument_id]}.
        E.g.
            234~{deribit~BTC-PERPETUAL}
            subscribe 234~{deribit~BTC-PERPETUAL} for BTC-PERPETUAL open interest on deribit
    */
    'OPEN_INTEREST_UNMAPPED_INSTRUMENT_UPDATE': '234',
    /*
    Redis key structure 235~{[exchange_internal_name]}~[instrument_id]
        E.g.
            235~{deribit}~BTC-PERPETUAL. zcard, zrange, zrevrange, zadd
    Only local redis and no streaming, used for open interest tick deduplicate
    */
    'OPEN_INTEREST_UNMAPPED_INSTRUMENT_LATEST_UPDATES_METADATA': '235',
    /*
    Redis key structure 236~{[exchange_internal_name]~[instrument_id]}
        E.g.
            236~{deribit~BTC-PERPETUAL}. hgetall
    Streaming key structure 236~{[exchange_internal_name]~[instrument_id]}
        E.g.
            236~{deribit~BTC-PERPETUAL}
            subscribe 236~{deribit~BTC-PERPETUAL} for BTC-PERPETUAL open interest on deribit
    */
    'OPEN_INTEREST_UNMAPPED_INSTRUMENT_MARKET_DATA': '236',
    /*
    Redis key structure 237~{[exchange_internal_name]~[instrument_id]}~[unitName]~[bucketName].
        E.g.
            237~{deribit~BTC-PERPETUAL}~MINUTE~FIRST_BUCKET. hget
            237~{deribit~BTC-PERPETUAL}~MINUTE~BUCKETS_CACHE. hgetall
            237~{deribit~BTC-PERPETUAL}~MINUTE~LAST_BUCKET. hget
    Streaming key structure 237~{[exchange_internal_name]~[instrument_id]}~[unitName].
        E.g.
            237~{deribit~BTC-PERPETUAL}~MINUTE
            subscribe 237~{deribit~BTC-PERPETUAL}~MINUTE for just minute data for BTC-PERPETUAL open interest on deribit
    */
    'OPEN_INTEREST_UNMAPPED_INSTRUMENT_HISTO_DATA': '237',


    'TRADECATCHUPCOMPLETE': '300',
    'NEWSCATCHUPCOMPLETE': '301',
    'UNMAPPEDTRADECATCHUPCOMPLETE': '314', //do not use
    'UNAUTHORIZED': '401',
    'RATELIMIT': '429',
    'NOTFOUND': '404',
    'ERROR': '500',

    'CURRENT_STAKING': '600',
    'HISTO_STAKING': '601',

    /*
    Only global redis.
    Redis key structure
        700~exchange~integrations. smembers
    */
    'EXCHANGE_INTERNAL_NAMES': '700',
    /*
    Local redis will have a key
       current~exchange~internal~name. get
    that only contains the exchange_internal_name
    Redis key structure: 701~{[exchange_internal_name]}~exchange~config.
        E.g.
            701~{coinbase}~exchange~config. hgetall
    */
    'EXCHANGE_METADATA': '701',
    /*
    Redis key structure 702~{[exchange_internal_name]}.
        E.g.
            702~{coinbase}. smembers
    */
    'UNMAPPED_INSTRUMENTS': '702',
    /*
    Redis key structure 703~{[exchange_internal_name]}~[instrument_id].
        E.g.
            703~{coinbase}~BTCUSD. hgetall
    */
    'UNMAPPED_INSTRUMENT_METADATA': '703',
    /*
    No redis keys
    Local redis publish under the redis key
        TRADES_SPOT~OUTPUT_QUEUE. lpush
    Saved in files - trades/cc-ms-message-output/[exchange_internal_name]/[instrument_id]/[hour_time].csv
        E.g.
            trades/cc-ms-message-output/coinbase/BTCUSD/2017-08-20-18-00-00.csv
    Streaming key structure 704~{[exchange_internal_name]~[instrument_id]}.
        E.g.
            704~{coinbase~BTCUSD}
            subscribe 704~{coinbase~BTCUSD} for BTCUSD on coinbase
    */
    'UNMAPPED_INSTRUMENT_TRADE': '704',
    /*
    Redis key structure 705~{[exchange_internal_name]}~[instrument_id]
        E.g.
            705~{coinbase}~BTCUSD. zcard, zrange, zrevrange, zadd
    Only local redis and no streaming, used for trades deduplicate
    */
    'UNMAPPED_INSTRUMENT_LATEST_TRADES_METADATA': '705',
    /*
    Redis key structure 706~{[exchange_internal_name]~[instrument_id]}
        E.g.
            706~{coinbase~BTCUSD}. hgetall
    Streaming key structure 706~{[exchange_internal_name]~[instrument_id]}
        E.g.
            706~{coinbase~BTCUSD}
            subscribe 706~{coinbase~BTCUSD} for BTCUSD on coinbase
    */
    'UNMAPPED_INSTRUMENT_MARKET_DATA': '706',
    /*
    Redis key structure 707~{[exchange_internal_name]~[instrument_id]}~[unitName]~[bucketName].
        E.g.
            707~{coinbase~BTCUSD}~MINUTE~FIRST_BUCKET. hget
            707~{coinbase~BTCUSD}~MINUTE~BUCKETS_CACHE. hgetall
            707~{coinbase~BTCUSD}~MINUTE~LAST_BUCKET. hget
    Streaming key structure 707~{[exchange_internal_name]~[instrument_id]}~[unitName].
        E.g.
            707~{coinbase~BTCUSD}~MINUTE
            subscribe 707~{coinbase~BTCUSD}~MINUTE for just minute data for BTCUSD on coinbase
    */
    'UNMAPPED_INSTRUMENT_HISTO_DATA': '707',

    /*

    Redis key structure
    708~{[exchange_internal_name]~[instrument_id]}~METADATA
    708~{[exchange_internal_name]~[instrument_id]}~[side].
        E.g.
        708~{coinbase~BTC-USD}~METADATA - hgetall - CCSEQ, BID_DEPTH, ASK_DEPTH, LAST_UPDATE etc
        708~{coinbase~BTC-USD}~BID - hgetall - PRICE:QUNATITY
        708~{coinbase~BTC-USD}~ASK - hgetall - PRICE:QUNATITY
    Redis key structure 708~{[exchange_internal_name]~[instrument_id]}.
        E.g.
           subscribe 708~{coinbase~BTC-USD}  TIMESTAMP, TIMESTAMP_NS, RECEIVED_TIMESTAMP, RECEIVED_TIMESTAMP_NS, SIDE, ACTION, PRICE, QUNATITY, SOURCE, CCSEQ
    */
    'UNMAPPED_ORDERBOOK_UPDATE_DATA': '708',
    'UNMAPPED_ORDERBOOK_SNAPSHOT': '798',

    /*

    Redis key structure
    709~{[exchange_internal_name]~[instrument_id]}~METADATA
    709~{[exchange_internal_name]~[instrument_id]}.
        E.g.
        709~{coinbase~BTC-USD}~METADATA - hgetall - CCSEQ, LAST_UPDATE etc
        709~{coinbase~BTC-USD}~BID - hgetall - TIMESTAMP, TIMESTAMP_NS, RECEIVED_TIMESTAMP, RECEIVED_TIMESTAMP_NS, SIDE, ACTION, PRICE, QUNATITY, SOURCE, CCSEQ
        709~{coinbase~BTC-USD}~ASK - hgetall - TIMESTAMP, TIMESTAMP_NS, RECEIVED_TIMESTAMP, RECEIVED_TIMESTAMP_NS, SIDE, ACTION, PRICE, QUNATITY, SOURCE, CCSEQ
    Streaming key structure 709~{[exchange_internal_name]~[instrument_id]}
        E.g.
           subscribe 709~{coinbase~BTC-USD} - TIMESTAMP, TIMESTAMP_NS, RECEIVED_TIMESTAMP, RECEIVED_TIMESTAMP_NS, SIDE, ACTION, PRICE, QUNATITY, SOURCE, CCSEQ
    */
    'UNMAPPED_ORDERBOOK_TOP_OF_BOOK_DATA': '709',
    'UNMAPPED_ORDERBOOK_TOP_OF_BOOK_SNAPSHOT': '799',



    'INTEGRATION_HEARTBEAT': '900',
    'SPOT_EXCHANGE_OUTPUT_HEARTBEAT': '902',
    'FUTURES_EXCHANGE_OUTPUT_HEARTBEAT': '907',

    'HEARTBEAT': '999'
};

module.exports = moduleExports;
