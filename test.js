require('./index.js').fetchAndDownload(
	// tags and links for things you want to fetch
	[
		'spyro male feral solo rating:safe',
		'dragon detailed_background wallpaper rating:safe'
	],
	// tags for things you don't want to fetch
	[] || require('fs').readFileSync('./blacklist.txt', 'utf8').split('\r\n'),
	// where to store the files
	'downloads'
);
