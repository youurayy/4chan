var optimist = require('optimist');
var argv = optimist
	.usage('\n4chan picture downloader.\nRun in the directory where you want the pictures to be downloaded.\nUsage: $0 [options] <thread URL>')
	.boolean('s')
	.alias('s', 'single-shot')
	.describe('s', 'Do not keep watching the thread for new posts, quit right after downloading all current pictures.')
	.alias('r', 'min-resolution')
	.describe('r', 'Do not download images with resolution less than this, e.g. -r 500x500.')
	.boolean('n')
	.alias('n', 'no-gifs')
	.describe('n', 'Do not download images in the GIF format.')
	.boolean('g')
	.alias('g', 'only-gifs')
	.describe('g', 'Only download images in the GIF format.')
	.boolean('m')
	.alias('m', 'mobile')
	.describe('m', 'Separate the pictures based on landscape or portrait orientation.')
	.argv;

var _ = require('underscore');
var fs = require('fs');
var request = require('request');
var laeh = require('laeh2').leanStacks(true);
var async = require('async-mini');

//require('utilz').watchFile(__filename);

function basename(fn) {
	var m = fn.match(/.*?([^\/]+)\/?$/);
	return m ? m[1] : fn;
}

process.on('SIGINT', function() {
	console.log('\nCTRL+C. 4chan downloader exit.');
	return process.exit();
});

if(argv._.length != 1) {
	console.log(optimist.help());
	process.exit();
}

var url = argv._[0], minWidth, minHeight;
var current;
var basedir = fs.realpathSync('.');
var basedirBasename = basename(basedir);
var landscapeDir = basedir + '/' + basedirBasename + '-ls';
var portraitDir = basedir + '/' + basedirBasename + '-po';

if(argv.r) {
	var m = /^(\d+)x(\d+)$/.exec(argv.r);
	if(!m) 
		tcb('Invalid value for the -r (--min-resolution) parameter, try --help.');
	minWidth = Number(m[1]);
	minHeight = Number(m[2]);
	console.log('Filtering by minimum size ' + minWidth + 'x' + minHeight + '.');
}

if(argv.n) {
	if(argv.g)
		tcb('Cannot have both -n and -g options, try --help.');
	console.log('Ignoring all GIFs.');
}

if(argv.g)
	console.log('Only downloading GIFs.');
	
if(dirExists(landscapeDir) || dirExists(portraitDir)) {
	argv.m = true;
	console.log('This is a mobile directory, >implying the -m option.');
}
else if(argv.m) {
	console.log('Separating pictures based on landscape/portrait orientation.');
}

if(argv.m) {
	if(!dirExists(landscapeDir)) {
		console.log('Creating ' + landscapeDir);
		fs.mkdirSync(landscapeDir);
	}
	if(!dirExists(portraitDir)) {
		console.log('Creating ' + portraitDir);
		fs.mkdirSync(portraitDir);
	}
}

if(argv.s)
	console.log('Working in one-shot mode.');

/*
<div class="file" id="f6487606">
	<div class="fileInfo">
		<span class="fileText" id="fT6487606">
			File: 
			<a href="//images.4chan.org/o/src/1341382908868.jpg" target="_blank">1341382908868.jpg</a>-(179 KB, 1920x1080, 
			<span title="1341174530513.jpg">1341174530513.jpg</span>)
		</span>
	</div>
	<a class="fileThumb" href="//images.4chan.org/o/src/1341382908868.jpg" target="_blank">
		<img src="//0.thumbs.4chan.org/o/thumb/1341382908868s.jpg" alt="179 KB" data-md5="VO7R4e+iSBdi3UIE5ES55Q==" 
			style="height: 140px; width: 250px;"/>
	</a>
</div>
<div class="postInfo desktop" id="pi6487606">
*/

console.log('press CTRL+C to exit.');

function getPics(url, cb) {
	request(url, _x(cb, true, function(err, res, body) {

		var ret = {
			index: new Object(null),
			order: []
		};

		if(res.statusCode != 200)
			cb('Cannot load (status ' + res.statusCode + '): ' + url);
	
		var m, re = /<a href="(\/\/images.4chan.org\/[^\/]+\/src\/)([^.]+)\.([^"]+)" target="_blank">[^<]+<\/a>-\([^,]+, (\d+)x(\d+),/g;
		
		while(m = re.exec(body)) {
			var entry = {
				file: m[2] + '.' + m[3],
				base: m[2],
				url: 'http:' + m[1] + m[2] + '.' + m[3],
				ext: m[3].toLowerCase(),
				width: Number(m[4]),
				height: Number(m[5])
			};
			
			if(argv.r && (entry.width < minWidth || entry.height < minHeight))
				continue;
				
			if(argv.n && entry.ext === 'gif')
				continue;
				
			if(argv.g && entry.ext !== 'gif')
				continue;
		
			ret.index[entry.file] = entry;
			ret.order.push(entry);
		}
		
		cb(null, ret);
	}));
}

function tcb(err) {
	console.log(err.stack || err);
	process.exit(1);
}

getPics(url, _x(tcb, true, function(err, ret) {

	downloadPics(ret, _x(tcb, true, function(err) {
		
		if(argv.s)
			tcb('Thread snapshot downloaded, exiting.');
		
		console.log("Initial download finished, \"I am monitoring this thread\" for new items now.");
		
		setInterval(_x(tcb, false, function() {
			
			getPics(url, _x(tcb, true, function(err, ret) {
				downloadPics(ret, _x(tcb, true, function(err) {
				}));
			}));
			
		}), 60000);
	}));
	
}));

function fileExists(file) {
	try {
		return fs.statSync(file).isFile();
	}
	catch(e) {
		return false;
	}
}

function dirExists(file) {
	try {
		return fs.statSync(file).isDirectory();
	}
	catch(e) {
		return false;
	}
}

function getFilenameFromEntry(entry) {
	if(argv.m) {
		if(entry.width < entry.height)
			return portraitDir + '/' + entry.file;
		else
			return landscapeDir + '/' + entry.file;
	}
	else {
		return basedir + '/' + entry.file;
	}
}

function downloadPics(ret, cb) {
	
	if(current) {
		_.each(current.order, function(entry) {
			if(!ret.index[entry.file]) {
				// previous entry disappeared from the thread, so delete the file
				var fname = getFilenameFromEntry(entry);
				console.log('Deleting ' + fname);
				fs.unlink(fname);
			}
		});
	}
	current = ret;
	
	var funcs = [];
	_.each(ret.order, function(entry) {
		
		var fname = getFilenameFromEntry(entry);
		if(fileExists(fname))
			return;
		
		funcs.push(function(cb) {
			
			var opts = {
				url: entry.url, 
				encoding: null
			};
			
			request(opts, _x(cb, true, function(err, res, body) {
				if(res.statusCode != 200)
					cb('Cannot load (status ' + res.statusCode + '): ' + entry.url);
				fs.writeFile(fname, body, null, _x(cb, true, function(err) {
					console.log(fname);
					cb();
				}));
			}));
			
		});
	});
	
	async.series(funcs, cb);
}
