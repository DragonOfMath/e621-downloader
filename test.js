const E621 = require('./index');

// where to store the files
const [downloadFolder = 'downloads', blacklistFile = './blacklist.txt'] = [].slice.call(process.argv, 2);

// tags for things you don't want to fetch
const blacklist = [] || require('fs').readFileSync(blacklistFile, 'utf8').split('\r\n');

// tags and links for things you want to fetch
const todo = [
	'spyro male feral solo rating:safe',
	'dragon detailed_background wallpaper rating:safe'
];

E621.fetchAndDownload(tags, blacklist, downloadFolder);
