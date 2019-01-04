
// 'use strict';

const fs = require('fs');
const mkdirp = require('mkdirp');
const gp = require('get-pixels');
const readline = require('readline');
const logger = require('./logger.js');
const requestor = require('./requestor.js');

var cfg;
var threads = 0;
var pic_count = 0;
var section_count = 0;
const pic_queue = [];
const section_queue = [];

process.on('SIGINT', () =>
{
	logger.debug('Bye!!!');
	process.exit(0);
});

process.on('uncaughtException', (err) =>
{
	logger.error('未捕获的异常:\n%s', err.stack);

	process.exit(1);
});

const valid_filename = function (in_file)
{
	return in_file.replace(/\/|\\|:|\*|\?|"|<|>|\||[\0-\037]/g, '');
};

const download_pic = function (url, path, retry_times, done_cb, ...args)
{
	// logger.debug('准备下载图片 %s...', url);

	fs.stat(path, (err_stat, stat) =>
	{
		if ((err_stat && 'ENOENT' == err_stat.code) || // 文件不存在
			0 == stat.size) // 文件为空
		{
			requestor.get(url, undefined, (err_req, pic, cookies) =>
			{
				if (err_req)
				{
					logger.error('%s 下载失败！', path);
					if (retry_times <= cfg.retry_times_max)
					{
						logger.error('正在开始第 %d 次重试！', retry_times);
						setTimeout(download_pic, 500, url, path, retry_times + 1, done_cb, ...args);
					}
					else
					{
						logger.error('重试多次未能下载成功！');
						done_cb(...args);
					}

					return;
				}

				fs.writeFileSync(path, pic, { encoding : 'binary' });

				if (retry_times > 1)
				{
					logger.debug('%s 下载成功！', path);
				}

				done_cb(...args);
			});
		}
		else
		{
			// logger.error('%s 已存在！', path);
			done_cb(...args);
		}
	});
};

const OnPicDone = function (thread_id, done_cb)
{
	threads--;

	readline.cursorTo(process.stdout, 0);
	process.stdout.write('图片下载进度 ' + ((pic_count - pic_queue.length) * 100 / pic_count).toFixed(2) + '%');

	if (pic_queue.length > 0)
	{
		setTimeout(process_pic_queue, 1, thread_id, done_cb);
	}
	else
	{
		readline.cursorTo(process.stdout, 0);
		logger.info('线程 %d / %d 所有图片已下载完成！', thread_id, cfg.download_threads);

		if (threads <= 0)
		{
			setTimeout(done_cb, 1);
		}
	}
};

const process_pic_queue = function (thread_id, done_cb)
{
	if (threads >= cfg.download_threads)
	{
		setTimeout(process_pic_queue, 1, thread_id, done_cb);
		return;
	}

	threads++;
	const q = pic_queue.shift();
	if (!q)
	{
		OnPicDone(thread_id, done_cb);
		return;
	}

	download_pic(q.url, q.path, 1, OnPicDone, thread_id, done_cb);
};

const get_section_pic_list = function (book_id, section_id, out_dir, cks, done_cb)
{
	const section_url = 'https://manhua.163.com/reader/' + book_id + '/' + section_id;
	requestor.get(section_url, cks, (err_req, html, cookies) =>
	{
		if (err_req)
		{
			logger.error('get_section_pic_list %s error:\n%s', section_url, err_req.stack);
			done_cb();
			return;
		}

		// window.PG_CONFIG.images = []
		const images = html.toString().match(/window.PG_CONFIG.images\s*=\s*\[([\s\S]+?)\];/i);
		const r_pics = /{([\s\S]+?)}/ig;

		try
		{
			var p = r_pics.exec(images[1]);
			do
			{
				if (!p)
				{
					logger.warn('本章为付费章节，不能下载！');
					break;
				}

				// titles: ""
				let pic_path = p[1].match(/title\s*:\s*"([\s\S]+?)",/i);
				// url: window.IS_SUPPORT_WEBP ? "" : ""
				let pic_url = p[1].match(/url\s*:[\s\S]+?\?\s*"[\s\S]+?"\s*:\s*"([\s\S]+?)",/i);

				pic_path = out_dir + '\\' +
					valid_filename(/\./.test(pic_path[1]) ? pic_path[1] : pic_path[1] + '.jpg');
				pic_url = pic_url[1].replace(/([\s\S]+?%3D)[0-9]*/i, '$1').replace(/(NOSAccessKeyId=[0-9a-fA-F]{32})[0-9]*/i, '$1');

				// logger.debug('正在队列：%s', pic_url);

				pic_queue.push({
					'url' : pic_url,
					'path' : pic_path
				});
			}
			while (p = r_pics.exec(images[1]));
		}
		catch (e)
		{
			logger.error('get_section_pic_list %s error:\n%s', section_url, e.stack);
		}

		done_cb();
	});
};

const process_section_queue = function (done_cb, cks)
{
	const q = section_queue.shift();
	mkdirp(q.out_dir, (err_md) =>
	{
		if (err_md)
		{
			logger.error('process_section_queue mkdir error:\n%s', err_md.stack);
			setTimeout(process_section_queue, 1, done_cb);
			return;
		}

		get_section_pic_list(q.book_id, q.section_id, q.out_dir, cks, () =>
		{
			readline.cursorTo(process.stdout, 0);
			process.stdout.write('各章节目录创建进度 ' +
				((section_count - section_queue.length) * 100 / section_count).toFixed(2) + '%');

			if (section_queue.length > 0)
			{
				setTimeout(process_section_queue, 1, done_cb, cks);
			}
			else
			{
				readline.cursorTo(process.stdout, 0);
				logger.info('所有章节目录已准备完成！');

				pic_count = pic_queue.length;
				for (let i = 0; i < cfg.download_threads; i++)
				{
					setTimeout(process_pic_queue, 1, i + 1, done_cb);
				}
			}
		});
	});
};

const get_section_list = function (book_index, out_dir, done_cb, cks)
{
	const section_list_url = 'https://manhua.163.com/book/catalog/' +
		cfg.book_ids[book_index] + '.json' +
		'?_c=' + new Date().getTime();
	requestor.get(section_list_url, cks, (err_req, html, cookies) =>
	{
		if (err_req)
		{
			logger.error('get_list %s error:\n%s', section_list_url, err_req.stack);
			done_cb();
			return;
		}

		var section_list = undefined;
		try
		{
			section_list = JSON.parse(html.toString());
		}
		catch (e)
		{
			logger.error('get_list parse list error:\n%s', e.stack);
			done_cb();
			return;
		}

		var o_dir = out_dir;
		const sections = section_list.catalog.sections;
		for (let i = 0; i < sections.length; i++)
		{
			if (sections.length > 1) // 有多个章节
			{
				o_dir = out_dir + '\\' + valid_filename(sections[i].fullTitle);
			}

			const section_infos = sections[i].sections;
			for (let j = 0; j < section_infos.length; j++)
			{
				const section_dir = o_dir + '\\' + valid_filename(section_infos[j].fullTitle);

				section_queue.push({
					'book_id' : section_infos[j].bookId,
					'section_id' : section_infos[j].sectionId,
					'out_dir' : section_dir
				});
			}
		}

		logger.info('开始准备各章节下载目录...');
		section_count = section_queue.length;
		process_section_queue(done_cb, cookies);
	});
};

const get_next_book = function (book_index, cks)
{
	if (book_index >= cfg.book_ids.length)
	{
		logger.info('所有图书已下载完毕！');
		return;
	}

	get_book(book_index, cks);
};

const get_book = function (book_index, cks)
{
	const book_url = 'https://manhua.163.com/source/' + cfg.book_ids[book_index];
	requestor.get(book_url, cks, (err_req, html, cookies) =>
	{
		if (err_req)
		{
			logger.error('get_title %s error:\n%s', book_url, err_req.stack);
			setTimeout(get_next_book, 1, book_index + 1, cookies);
			return;
		}

		// <title></title>
		const titles = html.toString().match(/<title>([\s\S]+?)<\/title>/i);
		if (titles && titles[1])
		{
			const title = titles[1].split(',');
			if (title && title.length > 0)
			{
				logger.info('准备下载图书《%s》的章节列表...', title[0]);

				const out_dir = cfg.output_dir + '\\' + valid_filename(title[0]);
				get_section_list(book_index, out_dir, () =>
				{
					setTimeout(get_next_book, 1, book_index + 1, cookies);
				}, cookies);
			}
		}
	});
};

const check_qrcode = function (csrfToken, token, cks)
{
	// logger.debug('检查二维码状态...');
	const check_qrcode_url = 'https://manhua.163.com/login/qrCodeCheck.json' +
		'?token=' + token +
		'&status=0' +
		'&csrfToken=' + csrfToken +
		'&_=' + Date.now();
	requestor.get(check_qrcode_url, cks, (err_req, html, cookies) =>
	{
		if (err_req)
		{
			logger.error('check_qrcode error:\n%s', err_req.stack);
			return;
		}

		try
		{
			const check_ret = JSON.parse(html.toString());
			if ('undefined' === typeof(check_ret.code) ||
				'undefined' === typeof(check_ret.status))
			{
				logger.error('check_qrcode json error:\n%s', html.toString());
				return;
			}

			if (200 != check_ret.code)
			{
				logger.error('check_qrcode code error:\n%d', check_ret.code);
				return;
			}

			// logger.debug(check_ret.status);
			switch (check_ret.status)
			{
				case 0: // 未扫描
				case 1: // 用户已成功扫描二维码，但未确认登录
					setTimeout(check_qrcode, 2000, csrfToken, token, cks); // 2 秒后继续检查二维码状态
					break;

				case 2:
				case -2: // 客户端已确认登录
					// logger.info('成功登录！%s', JSON.stringify(cookies));
					logger.info('成功登录！%s', html.toString());
					get_book(0, cookies);
					break;

				case -1: // 超时未扫描，重新获取二维码
				default:
					get_qrcode_url(csrfToken, cks);
					break;
			}
		}
		catch (e)
		{
			logger.error('check_qrcode exception:\n%s', e.stack);
		}
	});
};

const show_qrcode = function (qrcode_file)
{
	// 调用系统默认图片显示软件打开二维码
	// require('child_process').exec(require('path').resolve(qrcode_file));

	gp(qrcode_file, (err, pixels) =>
	{
		const ox = pixels.shape[0];
		const oy = pixels.shape[1];
		const depth = pixels.shape[2];
		const dx = Math.min(ox, process.stdout.columns / 2 - 1); // 一个中文字符占两个格，右边保留一个格
		const dy = Math.min(oy, process.stdout.rows - 2); // 留 1 行输出提示
		const dd = Math.min(dx, dy);

		if (dd < 60) // 当前控制台不足以把二维码完全显示出来
		{
			require('child_process').exec(require('path').resolve(qrcode_file));
		}
		else // 网易漫画的二维码扫描功能太弱，很多微信能扫出来的二维码网易都扫不出来
		{
			logger.info('请使用网易漫画客户端扫描二维码登录，操作方法：网易漫画客户端 -> 找漫画 -> 右上角扫描图标');

			for (let y = 0.0; y < oy; y += oy / dd)
			{
				const cy = Math.floor(y);
				for (let x = 0.0; x < ox; x += ox / dd)
				{
					const cx = Math.floor(x) * depth;
					if ((pixels.get(0, cy, cx) + pixels.get(0, cy, cx + 1) + pixels.get(0, cy, cx + 2)) / 3 > 128)
					{
						process.stdout.write('\033[1m■\033[0m');
					}
					else
					{
						process.stdout.write('\033[1m　\033[0m');
					}
				}

				process.stdout.write('\n');
			}
		}
	});
};

const get_qrcode = function (url, cks)
{
	logger.debug('获取二维码...');
	const qrcode_url = 'https://manhua.163.com' + url + '&utm_source=QRcode_login&utm_medium=web';
	requestor.get(qrcode_url, cks, (err_req, jpg, cookies) =>
	{
		if (err_req)
		{
			logger.error('get_qrcode error:\n%s', err_req.stack);
			return;
		}

		const qrcode_file = './qrCode.jpg';
		fs.writeFile(qrcode_file, jpg, (err_fs) =>
		{
			if (err_fs)
			{
				logger.error('get_qrcode writeFile error:\n%s', err_fs.stack);
				return;
			}

			show_qrcode(qrcode_file);
		});
	});
};

const get_qrcode_url = function (csrfToken, cks)
{
	logger.debug('获取二维码下载链接...');
	const qrcode_url = 'https://manhua.163.com/login/qrCodeLoginImage.json' +
		'?csrfToken=' + csrfToken +
		'&_=' + Date.now();
	requestor.get(qrcode_url, cks, (err_req, html, cookies) =>
	{
		if (err_req)
		{
			logger.error('get_qrcode_url error:\n%s', err_req.stack);
			return;
		}

		try
		{
			const qrcode_info = JSON.parse(html.toString());
			if ('undefined' === typeof(qrcode_info.url) ||
				'undefined' === typeof(qrcode_info.code) ||
				'undefined' === typeof(qrcode_info.token))
			{
				logger.error('get_qrcode_url json error:\n%s', html.toString());
				return;
			}

			if (200 != qrcode_info.code)
			{
				logger.error('get_qrcode_url code error:\n%d', qrcode_info.code);
				return;
			}

			get_qrcode(qrcode_info.url, cookies);
			check_qrcode(csrfToken, qrcode_info.token, cookies);
		}
		catch (e)
		{
			logger.error('get_qrcode_url exception:\n%s', e.stack);
		}
	});
};

const get_csrftoken = function ()
{
	logger.debug('获取 csrfToken...');
	requestor.get('https://manhua.163.com', undefined, (err_req, html, cookies) =>
	{
		if (err_req)
		{
			logger.error('get_csrftoken error:\n%s', err_req.stack);
			return;
		}

		try
		{
			// id="j-csrf" type="hidden" value=""
			let csrfToken = html.toString().match(/id="j-csrf"\s*type="hidden"\s*value="([\s\S]+?)"/i);
			get_qrcode_url(csrfToken[1], cookies);
		}
		catch (e)
		{
			logger.error('get_csrftoken exception:\n%s', e.stack);
		}
	});
};

(function ()
{
	logger.debug('Netease Cartoon Crawler Starting...');
	logger.debug('Produced by TZWSOHO 2018');
	logger.info('提示：建议最大化窗口方便显示完整二维码');

	try
	{
		cfg = require('./config.json');
	}
	catch (e)
	{
		logger.error('Load config failed!\n%s', e.stack);
		return;
	}

	// 二维码登录后获取
	get_csrftoken();

	// 不登录直接获取
	// get_book(0, []);
})();
