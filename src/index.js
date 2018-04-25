const FilePromise    = require('./FilePromise');
const RequestPromise = require('./RequestPromise');
const Format         = require('./formatting');

// Array utils
Array.prototype.forEachAsync = function (callback) {
	var iterable = this;
	function _next(i) {
		return Promise.resolve(callback(iterable[i], i))
		.then(() => {
			if (i < iterable.length - 1) {
				return _next(i+1);
			}
		});
	}
	return _next(0);
};
Array.prototype.mapAsync = function (callback) {
	var iterable = this;
	var mapped = [];
	function _next(i) {
		return Promise.resolve(callback(iterable[i], i))
		.then(value => {
			if (typeof(value) !== 'undefined') mapped.push(value);
			if (i < iterable.length - 1) {
				return _next(i+1);
			} else {
				return mapped;
			}
		});
	}
	return _next(0);
};
Array.prototype.flatten = function () {
	return [].concat(...this.map(x => x instanceof Array ? x.flatten() : [x]));
};
Array.prototype.unique = function () {
	return this.reduce((a,x) => {
		if (!a.includes(x)) a.push(x);
		return a;
	}, []);
};

class E621 {
	static search(tags = [], page = 1) {
		return RequestPromise.fetch('https://e621.net/post/index.json',{parameters:{tags,limit:100,page}}).then(r=>typeof(r)==='string'?JSON.parse(r):r);
	}
	static searchByID(id) {
		return this.search([`id:${id}`]).then(posts => posts[0]);
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
				console.log(`[Page ${page}] Got ${posts.length} posts from server.`)
				if (posts.length == 0) return allPosts;
				allPosts = allPosts.concat(posts);
				return _search(page + 1);
			});
		}
	}
	static fetch(todo = [], blacklist = []) {
		console.log('\nFetching posts...');
		return todo.mapAsync((item, idx) => {
			if (/e621.net\/.*\/([0-9a-f]{32})/.test(item)) {
				var hash = item.match(/[0-9a-f]{32}/);
				console.log(`[${idx+1}/${todo.length}] Searching for post with MD5: ${hash}`);
				
				return this.searchByMD5(hash)
				.then(post => {
					if (post) {
						console.log('Post found:',post.id);
					} else {
						console.log('Post not found.');
					}
					return post;
				});
			} else if (/e621\.net\/post\/show\/(\d+)/.test(item)) {
				var id = item.match(/show\/(\d+)/)[1];
				console.log(`[${idx+1}/${todo.length}] Searching for post with ID: ${id}`);
				
				return this.searchByID(id)
				.then(post => {
					if (post) {
						console.log('Post found:',post.id);
					} else {
						console.log('Post not found.');
					}
					return post;
				});
			} else {
				var tags = item.toLowerCase().split(' ');
				console.log(`[${idx+1}/${todo.length}] Searching for all posts with tags: ${item}`);
				
				return this.searchAll(tags)
				.catch(e => {
					console.error(e);
					return [];
				})
				.then(_posts => {
					if (_posts.length > 0) {
						var before = _posts.length;
						_posts = _posts.filter(p => p.tags.split(' ').every(t => !blacklist.includes(t)));
						var after = _posts.length;
						console.log(`${before} posts found, ${before-after} blacklisted, ${after} kept.`);
					} else {
						console.log('No posts found.');
					}
					return _posts;
				});
			}
		})
		.then(posts => {
			posts = posts.flatten().unique().filter(p => p != null);
			console.log('Fetched',posts.length,'posts total.');
			return posts;
		})
		.catch(e => {
			console.error(e);
			return [];
		});
	}
	static download(posts = [], directory = 'downloads') {
		directory = FilePromise.resolve(directory);
		
		if (!FilePromise.existsSync(directory)) {
			console.log('Making output directory...');
			FilePromise.makeDirSync(directory);
		}
		
		var total = 0, progress = 0, successful = 0, skipped = 0, failed = 0;
		for (var p of posts) {
			if (!p.id || !p.file_size || !p.file_url) {
				throw `Invalid Post object: ${JSON.stringify(p)}`;
			}
			total += p.file_size;
		}
		
		console.log(`\nPreparing to download...`);
		return posts.forEachAsync(function (post, p) {
			var filename = post.file_url.split('/').pop();
			var file = directory + '/' + filename;
			progress += post.file_size;
			var stuff = `[${p+1}/${posts.length} | ${Format.bytes(progress)}/${Format.bytes(total)} | ${Format.percent(progress/total)} | #${post.id}]`;
			if (FilePromise.existsSync(file)) {
				console.log(stuff, `Skipping ${filename} (already exists)`);
				skipped++;
			} else {
				console.log(stuff, `Downloading ${filename} (${Format.bytes(post.file_size)})`);
				return RequestPromise.download(post.file_url, file)
				.then(() => {
					successful++;
				})
				.catch(e => {
					failed++;
					console.error(e);
				});
			}
		})
		.then(() => {
			console.log(`\n---- RESULTS: ----\n${successful} successfully downloaded, ${skipped} skipped, ${failed} failed.`);
		})
		.catch(e => {
			console.error(e);
		});
	}
	static fetchAndDownload(todo, blacklist, directory) {
		return this.fetch(todo, blacklist).then(posts => this.download(posts, directory));
	}
}

module.exports = E621;
