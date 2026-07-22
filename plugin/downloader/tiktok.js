const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'https://appdl.pro/';
const APP_VERSION = '1.55';
const SSS_SALT = 'ssstik.io';
const SSS_KEY = 'b0lF_14022023_DK';

const client = axios.create({
    baseURL: BASE_URL
});

// semua helper

function simpleIntStrConvert(){...}

function md5(){...}

function generateTs(){...}

function generateTt(){...}

function buildUserAgent(){...}

function grabCookies(){...}

function cookieHeader(){...}

async function fetchInfo(){...}

async function tiktokDownloader(url, options = { hd:false }){
    ...
}

module.exports = {
    tiktokDownloader
};
