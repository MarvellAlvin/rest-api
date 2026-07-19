// services/obf.js
const JavaScriptObfuscator = require('javascript-obfuscator');

const presets = {
    low: {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        stringArray: true,
        stringArrayThreshold: 0.5,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        selfDefending: false,
    },
    medium: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.5,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.3,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.8,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        selfDefending: true,
        numbersToExpressions: true,
        splitStrings: true,
        splitStringsChunkLength: 8,
    },
    high: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 1,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.6,
        stringArray: true,
        stringArrayEncoding: ['rc4'],
        stringArrayThreshold: 1,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        selfDefending: true,
        numbersToExpressions: true,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 5,
        stringArrayCallsTransform: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        transformObjectKeys: true,
        unicodeEscapeSequence: false,
    },
};

function obfuscateCode(sourceCode, level = 'medium') {
    const options = presets[level] || presets.medium;
    const result = JavaScriptObfuscator.obfuscate(sourceCode, options);
    return result.getObfuscatedCode();
}

module.exports = { obfuscateCode, presets };
