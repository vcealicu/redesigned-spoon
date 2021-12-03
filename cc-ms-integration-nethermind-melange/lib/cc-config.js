const cache = {};

const getAllProcessVariables = () => {
    const processVariables = { ...process.env };
    for (const argument of process.argv.slice(2)) {
        const valuesArr = argument.split('=').map(function(arg) { return arg.trim(); });
        const propertyName = valuesArr[0];
        const propertyValue = valuesArr[1];
        if (propertyName && propertyValue) {
            processVariables[propertyName] = propertyValue;
        }
    }
    return processVariables;
};

const parseToType = (value, type) => {
    if (type === 'string') {
        return value;
    }
    if (type === 'number') {
        return parseFloat(value);
    }
    if (type === 'boolean') {
        return value === 'true';
    }
    return undefined;
};

const parse = (defaultArgs) => {
    const configObj = {};
    for (const propertyName in defaultArgs) {
        if (cache[propertyName] !== undefined) {
            configObj[propertyName] = cache[propertyName];
            continue;
        }
        const defaultPropertyValue = defaultArgs[propertyName];
        const propertyValue = processEnvVariables[propertyName] || defaultPropertyValue;
        const parsedProperty = propertyValue && parseToType(propertyValue.toString(), typeof defaultPropertyValue);
        if (parsedProperty) {
            configObj[propertyName] = parsedProperty;
            cache[propertyName] = parsedProperty;
        }
    }
    return configObj;
};

const processEnvVariables = getAllProcessVariables();

module.exports = {
    parse
};