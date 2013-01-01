var optimist = require('optimist');
var argv = optimist
    .usage('\n4chan picture downloader.\nRun in the directory where you want the pictures to be downloaded.\nUsage: $0 [options] <thread URL|forum URL>')
    .boolean('s')
    .alias('s', 'single-shot')
    .describe('s', 'Do not keep watching the thread for new posts, quit right after downloading all current pictures.')
    .alias('r', 'min-resolution')
    .describe('r', 'Default is -r 400x400 for -n, -r 100x100 otherwise. Doesn\'t apply for the index image.')
    .boolean('n')
    .alias('n', 'no-gifs')
    .describe('n', 'Do not download images in the GIF format.')
    .boolean('g')
    .alias('g', 'only-gifs')
    .describe('g', 'Only download images in the GIF format.')
    .boolean('m')
    .alias('m', 'mobile')
    .describe('m', 'Separate the pictures based on landscape or portrait orientation.')
    .alias('f', 'forum')
    .describe('f', 'Download pics from the whole subforum (a forum URL must be specified).')
    .boolean('f')
    .alias('t', 'threads')
    .describe('t', 'Separate the downloaded pics into directories by forum threads. Requires -f. Ignores -m.')
    .boolean('t')
    .alias('v', 'move')
    .describe('v', 'Special exclusive operation. Run after -f and -t to move all pics from subdirs to the current dir.')
    .boolean('v')
    .argv;

var _ = require('underscore');
var fs = require('fs');
var request = require('request');
var laeh = require('laeh2').leanStacks(true);
var _e = laeh._e;
var _x = laeh._x;
var async = require('async-mini');
var cheerio = require('cheerio');

//require('utilz').watchFile(__filename);

function basename(fn) {
    var m = fn.match(/.*?([^\/]+)\/?$/);
    return m ? m[1] : fn;
}

process.on('SIGINT', function() {
    console.log('\nCTRL+C. 4chan downloader exit.');
    return process.exit();
});

if(argv.v)
    return movePics(tcb);

function movePics(cb) {

    fs.readdirSync('.').forEach(function(d) {
    
        if(/^\./.test(d) || !fs.statSync(d).isDirectory())
            return;
    
        fs.readdirSync(d).forEach(function(f) {
            fs.renameSync(d + '/' + f, f);
        });
        
        fs.rmdirSync(d);
    });
}

if(argv._.length != 1) {
    console.log(optimist.help());
    process.exit();
}

var url = argv._[0], minWidth, minHeight;
var proto = /(.+?)\/\//.exec(url)[1];
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
else {
    if(argv.n) {
        minWidth = 400;
        minHeight = 400;
    }
    else {
        minWidth = 100;
        minHeight = 100;
    }
    console.log('Filtering by reasonable default minimum size ' + minWidth + 'x' + minHeight + '.');
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
else if(argv.t && argv.f) {
    console.log('Separating pictures based on thread.');
    delete argv.m;
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

if(argv.f) {
    
    console.log('Working in forum mode. Single-shot mode is >implied.');
    argv.s = true;
    
    var threads = { arr: [] };
    
    getIndex(url, _x(tcb, true, function(err, idx, threads) {
        
        var ff = _.map(idx, function(pageUrl) {
            return _x(null, false, function(cb) {
                getPage(pageUrl, threads, cb);
            });
        });
        
        async.parallel(ff, _x(tcb, true, function(err) {

            var f2 = _.map(threads.arr, function(threadUrl) {
                return _x(null, false, function(cb) {
                    getThread(threadUrl, cb);
                });
            });
            
            // be kind to the server, work serially
            // (there's a lot of threads in a forum)
            
            async.series(f2, _x(tcb, true, function(err) {
                
                tcb(null, 'Forum snapshot downloaded, exit.');
            }));
            
        }));
    }));
    
}
else {

    if(argv.s)
        console.log('Working in one-shot mode.');

    getThread(url, tcb);
}


function getIndex(url, cb) { // cb(err, idx, threads)
    
    console.log('Downloading page and thread index.');
    
    request(url, _x(cb, true, function(err, res, body) {
        
        var idx = extractPageUrls(body);
        
        extractThreadUrls(body, threads);
        
        cb(null, idx, threads);
    }));
}

function getPage(url, threads, cb) {
    
    request(url, _x(cb, true, function(err, res, body) {
    
        extractThreadUrls(body, threads);
        
        cb(null);
    }));
}

function extractThreadUrls(body, threads) {

    var $ = cheerio.load(body);
    threads.arr = _.union(threads.arr, $('div.thread').map(function() {
        return url + 'res/' + $(this).attr('id').substr(1);
    }));
}

function extractPageUrls(body, idx) {
    
    var $ = cheerio.load(body);
    return $('div.desktop div.pages a').map(function() {
        return url + $(this).attr('href');
    });
}

console.log('press CTRL+C to exit.');

function getPics(url, thread, cb) {
    
    request(url, _x(cb, true, function(err, res, body) {

        var ret = {
            index: new Object(null),
            order: []
        };

        if(res.statusCode == 404)
            return cb(null, 'Thread 404\'d, exiting.');

        if(res.statusCode != 200)
            return cb('Cannot load (status ' + res.statusCode + '): ' + url);

        var $ = cheerio.load(body);
        
        $('a.fileThumb').each(function(i, elem) {
            
            var el = $(this);
            var imgUrl = proto + el.attr('href'); // http://images.4chan.org/s/src/1347323616243.jpg
            var m = /\/([^\/\.]+)\.([^\/]+)$/.exec(imgUrl);
            
            var m2, m3, text = el.parent().find('div.fileInfo span.fileText').text();
            if(text) {
                m3 = /(\d+)x(\d+)/.exec(text);
            }
            else {
                // w/h for the index image (will slip through the w/h filter, no choice)
                var style = el.find('img').attr('style')
                m2 = /height:\s+(\d+)px;\s+width:\s+(\d+)px/.exec(style); // 'height: 125px; width: 83px;'
            }
            
            var entry = {
                file: m[1] + '.' + m[2],
                base: m[1],
                url: imgUrl,
                ext: m[2].toLowerCase(),
                width: m3 ? m3[1] : Number(m2[2]),
                height: m3 ? m3[2] : Number(m2[1]),
                thread: thread
            };

            var skip = 
                (argv.r && (entry.width < minWidth || entry.height < minHeight))
                || (argv.n && entry.ext === 'gif')
                || (argv.g && entry.ext !== 'gif');
            
            if(!skip) {
                ret.index[entry.file] = entry;
                ret.order.push(entry);
            }
        });
        
        cb(null, ret);
    }));
}

function tcb(err, msg) {
    if(err) {
        console.log(err.stack || err);
        process.exit(1);
    }
    else {
        console.log(msg);
        process.exit(0);
    }
}

function getThread(url, cb) { // cb(err, msg)
    
    var thread = /([^\/]+)$/.exec(url)[1];
    if(argv.t) {
        var threadDir = basedir + '/' + thread;
        if(!fs.existsSync(threadDir))
            fs.mkdirSync(threadDir);
    }
    
    getPics(url, thread, _x(cb, true, function(err, ret) {

        downloadPics(ret, _x(cb, true, function(err) {
        
            if(argv.s)
                return cb(null, 'Thread snapshot downloaded, exiting.');
        
            console.log("Initial download finished, \"I am monitoring this thread\" for new items now.");
        
            setInterval(_x(cb, false, function() {
            
                getPics(url, thread, _x(cb, true, function(err, ret) {
                    downloadPics(ret, _x(cb, true, function(err) {
                    }));
                }));
            
            }), 60000);
        }));
    
    }));
}

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
    if(argv.t) {
        return basedir + '/' + entry.thread + '/' + entry.file;
    }
    else if(argv.m) {
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
    
    if(current && !argv.f) {
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
                if(res.statusCode == 404) {
                    console.log('Cannot load (status ' + res.statusCode + '): ' + entry.url);
                    cb();
                }
                else if(res.statusCode != 200) {
                    cb('Cannot load (status ' + res.statusCode + '): ' + entry.url);
                }
                else {
                    fs.writeFile(fname, body, null, _x(cb, true, function(err) {
                        console.log(fname);
                        cb();
                    }));
                }
            }));
            
        });
    });
    
    async.series(funcs, cb);
}
