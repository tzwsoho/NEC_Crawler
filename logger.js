
'use strict';

const util = require('util');
const colors = require('colors');

Date.prototype.Format = function (fmt)
{
	var o = {
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

	for (var k in o)
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

var Logger = function ()
{

};

Logger.log = function (type, fmt, ...args)
{
	const now = new Date().Format('yyyy-MM-dd HH:mm:ss.ff');
	const str = util.format(colors['time']('%s ') + colors[type](fmt), now, ...args);
	console.log(str);
};

Logger.debug = function (fmt, ...args)
{
	Logger.log('debug', fmt, ...args);
};

Logger.info = function (fmt, ...args)
{
	Logger.log('info', fmt, ...args);
};

Logger.warn = function (fmt, ...args)
{
	Logger.log('warn', fmt, ...args);
};

Logger.error = function (fmt, ...args)
{
	Logger.log('error', fmt, ...args);
};

module.exports = Logger;
