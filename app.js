
'use strict';

const fs = require('fs');
const https = require('https');
const mkdirp = require('mkdirp');
const readline = require('readline');
const logger = require('./logger.js');
const requestor = require('./requestor.js');

var cfg = undefined;
var threads = 0;
var pic_queue = [];
var section_queue = [];
var pic_count = 0;
var section_count = 0;

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

var valid_filename = function (in_file)
{
	return in_file.replace(/\/|\\|\:|\*|\?|\"|\<|\>|\||[\0-\x1f]/g, '');
};

var download_pic = function (url, path, retry_times, done_cb, ...args)
{
	// logger.debug('准备下载图片 %s...', url);

	fs.stat(path, (err_stat, stat) =>
	{
		if ((err_stat && 'ENOENT' == err_stat.code) || // 文件不存在
			0 == stat.size) // 文件为空
		{
			new requestor(url, (err_req, pic) =>
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

var OnPicDone = function (thread_id, done_cb)
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

var process_pic_queue = function (thread_id, done_cb)
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

var get_section_pic_list = function (book_id, section_id, out_dir, done_cb)
{
	const section_url = 'https://manhua.163.com/reader/' + book_id + '/' + section_id;
	new requestor(section_url, (err_req, html) =>
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

var process_section_queue = function (done_cb)
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

		get_section_pic_list(q.book_id, q.section_id, q.out_dir, () =>
		{
			readline.cursorTo(process.stdout, 0);
			process.stdout.write('各章节目录创建进度 ' +
				((section_count - section_queue.length) * 100 / section_count).toFixed(2) + '%');

			if (section_queue.length > 0)
			{
				setTimeout(process_section_queue, 1, done_cb);
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

var get_section_list = function (book_index, out_dir, done_cb)
{
	const section_list_url = 'https://manhua.163.com/book/catalog/' +
		cfg.book_ids[book_index] + '.json' +
		'?_c=' + new Date().getTime();
	new requestor(section_list_url, (err_req, html) =>
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
		process_section_queue(done_cb);
	});
};

var get_next_book = function (book_index)
{
	if (book_index >= cfg.book_ids.length)
	{
		logger.info('所有图书已下载完毕！');
		return;
	}

	get_book(book_index);
};

var get_book = function (book_index)
{
	const book_url = 'https://manhua.163.com/source/' + cfg.book_ids[book_index];
	new requestor(book_url, (err_req, html) =>
	{
		if (err_req)
		{
			logger.error('get_title %s error:\n%s', book_url, err_req.stack);
			get_next_book(book_index + 1);
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
					get_next_book(book_index + 1);
				});
			}
		}
	});
};

(function ()
{
	logger.debug('Netease Cartoon Crawler Starting...');
	logger.debug('Produced by TZWSOHO 2018');

	try
	{
		cfg = require('./config.json');
	}
	catch (e)
	{
		logger.error('Load config failed!\n%s', e.stack);
		return;
	}

	get_book(0);
})();
