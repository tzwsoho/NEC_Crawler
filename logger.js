
'use strict';

const util = require('util');
const colors = require('colors');

Date.prototype.Format = function (fmt)
{
	const o = {
		"M+": this.getMonth() + 1,
		"d+": this.getDate(),
		"H+": this.getHours(),
		"m+": this.getMinutes(),
		"s+": this.getSeconds(),
		"q+": Math.floor((this.getMonth() + 3) / 3),
		"f+": this.getMilliseconds()
	};

	if (/(y+)/.test(fmt))
	{
		fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
	}

	for (let k in o)
	{
		if (new RegExp("(" + k + ")").test(fmt))
		{
			fmt = fmt.replace(RegExp.$1,
				(RegExp.$1.length == 1) ?
					(o[k]) :
					(("00" + o[k]).substr(("" + o[k]).length)));
		}
	}

	return fmt;
}

colors.setTheme({
	time : 'white',
	debug : 'green',
	info : 'yellow',
	warn : 'magenta',
	error : 'red'
});

const log = function (type, fmt, ...args)
{
	const now = new Date().Format('yyyy-MM-dd HH:mm:ss.ff');
	const str = util.format(colors['time']('%s ') + colors[type](fmt), now, ...args);
	console.log(str);
};

exports.debug = function (fmt, ...args)
{
	log('debug', fmt, ...args);
};

exports.info = function (fmt, ...args)
{
	log('info', fmt, ...args);
};

exports.warn = function (fmt, ...args)
{
	log('warn', fmt, ...args);
};

exports.error = function (fmt, ...args)
{
	log('error', fmt, ...args);
};
