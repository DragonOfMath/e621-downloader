const FilePromise    = require('./utils/FilePromise');
const RequestPromise = require('./utils/RequestPromise');
const FileExplorer   = require('./utils/FileExplorer');
const Format         = require('./utils/formatting');
const Array          = require('./utils/Array');
const Logger         = require('./utils/Logger');

const E621_INDEX_URL = 'https://e621.net/post/index.json'; // params: tags, limit, page
const E621_POST_URL  = 'https://e621.net/post/show.json'; // params: id
const E621_POOL_URL  = 'https://e621.net/pool/show.json'; // params: id

const POST_REGEX     = /https?:\/\/e621\.net\/post\/show\/(\d+)/;
const POOL_REGEX     = /https?:\/\/e621\.net\/pool\/show\/(\d+)/;
const DIRECT_REGEX   = /e621.net\/.*\/([0-9a-f]{32})/;
const HASH_REGEX     = /[0-9a-f]{32}/;
const ID_REGEX       = /show\/(\d+)/;

var logger = new Logger('e621 Downloader');

class E621 {
	static search(tags = [], page = 1) {
		return RequestPromise.get(E621_INDEX_URL, {
			parameters: {tags, limit: 100, page}
		}).then(r => typeof(r)==='string' ? JSON.parse(r) : r);
	}
	static getPost(id) {
		return RequestPromise.get(E621_POST_URL, {
			parameters: {id}
		});
	}
	static getPool(id) {
		var poolPosts = [];
		return _getPoolPage(1);
		function _getPoolPage(page) {
			return RequestPromise.get(E621_POOL_URL, {
				parameters: {id, page}
			})
			.then(posts => {
				logger.log(`[Page ${page}] Got ${posts.length} posts from server.`);
				if (posts.length == 0) return poolPosts;
				poolPosts = poolPosts.concat(posts);
				return _getPoolpage(page + 1);
			});
		}
	}
	static searchByMD5(hash) {
		return this.search([`md5:${hash}`]).then(posts => posts[0]);
	}
	static searchAll(tags = []) {
		var allPosts = [];
		return _search(1);
		function _search(page) {
			return E621.search(tags, page)
			.then(posts => {
				logger.log(`[Page ${page}] Got ${posts.length} posts from server.`)
				if (posts.length == 0) return allPosts;
				allPosts = allPosts.concat(posts);
				return _search(page + 1);
			});
		}
	}
	static fetch(todo = [], blacklist = []) {
		logger.log('\nFetching posts...');
		return todo.mapAsync((item, idx) => {
			if (DIRECT_REGEX.test(item)) {
				var hash = item.match(HASH_REGEX);
				logger.log(`[${idx+1}/${todo.length}] Searching for post with MD5: ${hash}`);
				
				return this.searchByMD5(hash)
				.then(post => {
					logger.indent();
					if (post) {
						logger.green('Post found:',post.id);
					} else {
						logger.red('Post not found.');
					}
					logger.unindent();
					return post;
				});
			} else if (POST_REGEX.test(item)) {
				var id = item.match(ID_REGEX)[1];
				logger.log(`[${idx+1}/${todo.length}] Fetching single post: ${id}`);
				
				return this.getPost(id)
				.then(post => {
					logger.indent();
					if (post) {
						logger.green('Post found:',post.id);
					} else {
						logger.red('Post not found.');
					}
					logger.unindent();
					return post;
				});
			} else if (POOL_REGEX) {
				var id = item.match(ID_REGEX)[1];
				logger.log(`[${idx+1}/${todo.length}] Fetching posts in pool: ${id}`);
				
				return this.getPool(id)
				.then(_posts => {
					logger.indent();
					if (_posts.length) {
						logger.green(`${_posts.length} posts retrieved.`);
					} else {
						logger.red('No posts found.');
					}
					logger.unindent();
					return _posts;
				});
			} else {
				var tags = item.toLowerCase().split(' ');
				logger.log(`[${idx+1}/${todo.length}] Searching for all posts with tag(s): ${item}`);
				
				return this.searchAll(tags)
				.catch(e => {
					logger.error(e);
					return [];
				})
				.then(_posts => {
					logger.indent();
					if (_posts.length > 0) {
						var before = _posts.length;
						_posts = _posts.filter(p => p.tags.split(' ').every(t => !blacklist.includes(t)));
						var after = _posts.length;
						logger.green(`${before} posts found, ${before-after} blacklisted, ${after} kept.`);
					} else {
						logger.red('No posts found.');
					}
					logger.unindent();
					return _posts;
				});
			}
		})
		.then(posts => {
			posts = posts.flatten().unique().filter(p => p != null);
			logger.log('Fetched',posts.length,'posts total.');
			return posts;
		})
		.catch(e => {
			logger.error(e);
			return [];
		});
	}
	static download(posts = [], directory = 'downloads') {
		directory = FilePromise.resolve(directory);
		
		if (!FilePromise.existsSync(directory)) {
			logger.log('Making output directory "' + directory + '"');
			FilePromise.makeDirSync(directory);
		}
		
		var total = 0, progress = 0, successful = 0, skipped = 0, failed = 0;
		for (var p of posts) {
			if (!p.id || !p.file_size || !p.file_url) {
				throw `Invalid Post object: ${JSON.stringify(p)}`;
			}
			total += p.file_size;
		}
		
		logger.log(`\nPreparing to download ${posts.length} files...`);
		return posts.forEachAsync(function (post, p) {
			var filename = post.file_url.split('/').pop();
			var file = directory + '/' + filename;
			progress += post.file_size;
			var stuff = `[${p+1}/${posts.length} | ${Format.bytes(progress)}/${Format.bytes(total)} | ${Format.percent(progress/total)} | #${post.id}]`;
			if (FilePromise.existsSync(file)) {
				logger.yellow(stuff, `Skipping ${filename} (already exists)`);
				skipped++;
			} else {
				logger.green(stuff, `Downloading ${filename} (${Format.bytes(post.file_size)})`);
				// TODO: show download progress somehow?
				return RequestPromise.download(post.file_url, file)
				.then(() => {
					successful++;
				})
				.catch(e => {
					failed++;
					logger.error(e);
				});
			}
		})
		.then(() => {
			logger.ln();
			logger.green( `Downloaded: ${successful}`);
			logger.yellow(`Skipped:    ${skipped}`);
			logger.red(   `Failed:     ${failed}`);
			logger.log(   `Total:      ${posts.length} (${Format.bytes(total)})`);
			
			FileExplorer.goto(directory);
		})
		.catch(e => {
			logger.error(e);
		});
	}
	static fetchAndDownload(todo, blacklist, directory) {
		return this.fetch(todo, blacklist).then(posts => this.download(posts, directory));
	}
}

module.exports = E621;
