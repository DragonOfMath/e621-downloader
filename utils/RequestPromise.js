const request = require('request');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const APP_DIR = path.dirname(require.main.filename);

class RequestPromise {
	static resolve(filename) {
		if (path.isAbsolute(filename)) {
			return filename;
		} else {
			return path.resolve(APP_DIR, filename);
		}
	}
	static fetch(url, options = {}) {
		options.url = options.url || url;
		if (options.parameters) {
			options.url += '?' + Object.keys(options.parameters).map(param => {
				if (options.parameters[param] instanceof Array) {
					return `${param}=${options.parameters[param].join('+')}`;
				} else {
					return `${param}=${options.parameters[param]}`;
				}
			}).join('&');
		}
		options.json = /json$/i.test(url);
		options.headers = {'User-Agent': 'E621Downloader (DragonOfMath @ github)'};
		options.qs = {limit: 100};
		return new Promise((resolve,reject) => {
			request(options, function (error, response, body) {
				if (error) {
					reject(error);
				} else if (response.statusCode !== 200) {
					reject('Status Code: '+response.statusCode);
				} else try {
					resolve(body);
				} catch (e) {
					reject(e.message);
				}
			});
		});
	}
	static download(url, dest) {
		dest = this.resolve(dest);
		return new Promise((resolve, reject) => {
			var file = fs.createWriteStream(dest);
			var request = https.get(url, response => {
				response.pipe(file);
				file.on('finish', function() {
					file.close(resolve);
				});
			}).on('error', e => {
				fs.unlink(dest);
				reject(e);
			});
		});
	}
}


module.exports = RequestPromise;
