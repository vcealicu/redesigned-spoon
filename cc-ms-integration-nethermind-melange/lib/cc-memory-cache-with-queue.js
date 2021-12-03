'use strict';
let asyncNode = require('async');

function mem_cache_not_a_singleton(cacheLengthSeconds = 120) {
    let memCache = {};
    /* EXAMPLE USE
        let memoryCache = new (require('ccc-memory-cache-with-queue'))();
        let getData = function(currentTimestamp, getDataCallback){
            let cacheKey = 'unique_key';
            memoryCache.getDataWithCache(cacheKey, currentTimestamp, function(gotDataCallback) {
                //get data from somewhere async (db, redis, external call etc.)
                //gotDataCallback(getUserDataErr, data);
            }, function(errGettingData, cacheHit, data){
                if(errGettingData !== false){
                    getDataCallback(errGettingData, data);
                    return;
                }

                getDataCallback(false, data);
            });
        };
    */

    let CACHE = {
        keys: {}, // they have a queue, an is loading and an expiry date in unix timsetamp seconds
        cacheLengthSeconds: cacheLengthSeconds,
        nextCacheClear: 0,
        stats: {
            hit: 0,
            miss: 0,
            total_keys: 0,
            total_deletes: 0
        },
        isClearingExpiredCache: false
    };

    memCache.setCacheLength = function(newCacheLengthInSeconds) {
        CACHE.cacheLengthSeconds = newCacheLengthInSeconds;
    };

    memCache.getCacheLength = function() {
        return CACHE.cacheLengthSeconds;
    };

    memCache.getQueueLengthForCacheKey = function(cacheKey) {
        let localMemoryCache = CACHE;
        if (localMemoryCache.keys[cacheKey] !== undefined) {
            return localMemoryCache.keys[cacheKey].queue.length;
        }
        return 0;
    };

    memCache.getStats = function() {
        return CACHE.stats;
    };

    memCache.deleteCacheKey = function(cacheKey) {
        CACHE.stats.total_keys--;
        CACHE.stats.total_deletes++;
        delete CACHE.keys[cacheKey];
    };

    memCache.getDataWithCache = function(cacheKey, currentTimestampSeconds, functionToGetData, callbackAfterData) {
        //callbackAfterData(error, cacheHit, dataToReturn);
        let localMemoryCache = CACHE;
        let needsToGetFromDataSource = true;
        if (localMemoryCache.keys[cacheKey] !== undefined) {
            if (localMemoryCache.keys[cacheKey].isLoading === true) {
                localMemoryCache.stats.hit++;
                localMemoryCache.keys[cacheKey].queue.push(callbackAfterData);
                //exit if we push it in the queue.
                return;
            } else {
                //if the key is not expired
                if (localMemoryCache.keys[cacheKey].expires > currentTimestampSeconds) {
                    localMemoryCache.stats.hit++;
                    needsToGetFromDataSource = false;
                } else {
                    //the key is expired
                    localMemoryCache.stats.miss++;
                    localMemoryCache.keys[cacheKey].isLoading = true;
                    localMemoryCache.keys[cacheKey].queue.push(callbackAfterData);
                    needsToGetFromDataSource = true;
                }
            }
        } else {
            localMemoryCache.stats.total_keys++;
            localMemoryCache.stats.miss++;
            localMemoryCache.keys[cacheKey] = {
                isLoading: true,
                queue: [callbackAfterData],
                data: [],
                expires: currentTimestampSeconds + localMemoryCache.cacheLengthSeconds
            };
        }
        if (needsToGetFromDataSource) {
            localMemoryCache.keys[cacheKey].isLoading = true;
            localMemoryCache.keys[cacheKey].expires = currentTimestampSeconds + localMemoryCache.cacheLengthSeconds;
            functionToGetData(function(err, data) {
                memCache.finishedLoadingFromDB(err, currentTimestampSeconds, cacheKey, data);
            });
        } else {
            setImmediate(function() {
                callbackAfterData(localMemoryCache.keys[cacheKey].error, true, localMemoryCache.keys[cacheKey].data);
                memCache.tryToClearExpiredCache(currentTimestampSeconds);
            });
        }
    };

    memCache.finishedLoadingFromDB = function(error, currentTimestampSeconds, cacheKey, data) {
        let localMemoryCache = CACHE;
        localMemoryCache.keys[cacheKey].data = data;
        localMemoryCache.keys[cacheKey].error = error;
        localMemoryCache.keys[cacheKey].isLoading = false;
        asyncNode.whilst(
            function(testCallback) {
                if (testCallback === undefined) {
                    return localMemoryCache.keys[cacheKey].queue.length > 0;
                }
                setImmediate(testCallback, false, localMemoryCache.keys[cacheKey].queue.length > 0);
            },
            function(callbackIterationDone) {
                let callbackInQueue = localMemoryCache.keys[cacheKey].queue.shift();
                callbackInQueue(error, false, data);
                setImmediate(callbackIterationDone);
            },
            function(err, n) {
                if (err) {}
                memCache.tryToClearExpiredCache(currentTimestampSeconds);
            }
        );
    };

    memCache.tryToClearExpiredCache = function(currentTimestampSeconds, tryToClearExpiredCacheCallback) {
        //using isClearingExpiredCache because depending on the cacheLengthSeconds and the size of the keys object we might not finish running though
        //all the keys in an async way before the cache needs to be checked again.
        if (currentTimestampSeconds < CACHE.nextCacheClear || CACHE.isClearingExpiredCache === true) {
            if (tryToClearExpiredCacheCallback !== undefined) {
                setImmediate(function() {
                    tryToClearExpiredCacheCallback(0, CACHE.stats.total_keys);
                });
            }
            return;
        }

        CACHE.isClearingExpiredCache = true;
        CACHE.nextCacheClear = currentTimestampSeconds + 2 * CACHE.cacheLengthSeconds;
        let totalObjectsCleared = 0;
        //clear keys that have expired more than a full cache length ago.
        let timestampToClear = currentTimestampSeconds - CACHE.cacheLengthSeconds;
        asyncNode.eachOfSeries(CACHE.keys, function(cachedObject, cacheKey, currentObjectCleared) {
            if (cachedObject.expires < timestampToClear) {
                if (cachedObject.isLoading === true) {
                    cachedObject.expires = currentTimestampSeconds + CACHE.cacheLengthSeconds;
                } else {
                    totalObjectsCleared = totalObjectsCleared + 1;
                    memCache.deleteCacheKey(cacheKey);
                }
            }
            setImmediate(currentObjectCleared);
        }, function(err) {
            if (err) {}
            CACHE.isClearingExpiredCache = false;
            if (tryToClearExpiredCacheCallback !== undefined) {
                tryToClearExpiredCacheCallback(totalObjectsCleared, CACHE.stats.total_keys);
            }
        });

    };
    return memCache;
}

module.exports = mem_cache_not_a_singleton;
