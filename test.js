const E621 = require('./index');

// where to store the files
const [downloadFolder = 'downloads', blacklistFile = './blacklist.txt', ...todo] = [].slice.call(process.argv, 2);

// tags for things you don't want to fetch
const blacklist = require('fs').readFileSync(blacklistFile, 'utf8').split('\r\n');

E621.fetchAndDownload(todo, blacklist, downloadFolder);
