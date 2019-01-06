
'use strict';

const request = require('request');

exports.jar = function ()
{
	return request.jar();
};

exports.get = function (url, jar, cb)
{
	request.defaults({ jar: true });
	return request({ url: url, jar: jar, timeout: 5000 }, (err, res, body) =>
	{
		cb(err, body);
	});
};
