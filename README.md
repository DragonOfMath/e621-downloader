# e621-downloader
Node.js bulk-file downloader client for e621.net

# Installation
```bat
npm install e621-downloader --save
```

# Usage
Require the downloader module and call its fetchAndDownload() method.
```js
static fetchAndDownload(todo, [blacklist], [directory])
```
* `todo` is an array of tags and links you can use to locate and retrieve files for downloading.
* `blacklist` is an array of tags to filter content with, as sometimes that is necessary.
* `directory` is the path to save the files to. If left out, it will download to a local `/downloads/` folder.

When ran, it will first fetch all the file metadata, including their IDs, hashes, file sizes, etc. Depending on how many posts it must retrieve, the process may take from less than a minute to half an hour.

Once it has compiled a queue, it will begin downloading sequentially. Files already on disk will be skipped to save time and resources. After all files have been processed and downloaded, it will display the number of successful downloads, skipped files, and failed ones. 
