
'use strict';

const https = require('https');
const logger = require('./logger.js');

var Requestor = function (url, cb)
{
	const req = https.get(url, (res) =>
	{
		var bufs = [];
		res.on('data', (chunk) =>
		{
			bufs.push(chunk);
		})
		.on('end', () =>
		{
			cb(undefined, Buffer.concat(bufs));
		});
	})
	.on('timeout', () =>
	{
		cb(new Error('timeout'), undefined);
	})
	.on('error', (err_https) =>
	{
		cb(err_https, undefined);
	});

	req.setTimeout(5000);
};

module.exports = Requestor;
