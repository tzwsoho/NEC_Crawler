
'use strict';

const request = require('request');

exports.get = function (url, cookies, cb)
{
	const j = request.jar();
	if (Array.isArray(cookies))
	{
		for (let cookie of cookies)
		{
			try
			{
				j.setCookie(cookie, url);
			}
			catch (e)
			{
				console.error('setCookie %s %s:\n%s', cookie, url, e.stack);
			}
		}
	}

	request.defaults({ jar: j });
	request.get(url).on('response', (res) =>
	{
		var cks = [];
		const bufs = [];
		res.on('data', (chunk) =>
		{
			bufs.push(chunk);

			const set_cookie = res.headers['set-cookie'];
			if ('undefined' === typeof(set_cookie))
			{
				return;
			}

			cks = cks.concat(set_cookie);
		})
		.on('end', () =>
		{
			cb(undefined, Buffer.concat(bufs), cks);
		});
	})
	.on('error', (err) =>
	{
		cb(err, undefined);
	});
};
