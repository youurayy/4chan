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
    .describe('v', 'Run after -f -t to move all pics from subdirs to the current dir.')
    .boolean('v')
    .alias('d', 'delete')
    .describe('d', 'Run after -f -t and before -v. Deletes empty dirs or with a dash in name. If given a number, delete dirs with less than or equal number of files.')
    .boolean('d')
    .alias('y', 'dry-run')
    .describe('y', 'Use with -d. Only show what would be deleted, but don\'t delete anything.')
    .boolean('y')
    .alias('p', 'split')
    .describe('p', 'Run after -v. Randomize and split into subfolders. Takes an optional number. Default is 1000.')
    .boolean('p')
    .argv;

var _ = require('underscore');
var fs = require('fs');
var request = require('request');
var laeh = require('laeh2').leanStacks(true);
var _e = laeh._e;
var _x = laeh._x;
var async = require('async-mini');
var cheerio = require('cheerio');
var fsutil = require('fsutil');

//require('utilz').watchFile(__filename);

var url = argv._[0], minWidth, minHeight;
var current;
var basedir = fs.realpathSync('.');
var basedirBasename = basename(basedir);
var landscapeDir = basedir + '/' + basedirBasename + '-ls';
var portraitDir = basedir + '/' + basedirBasename + '-po';

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

if(argv.d)
    return deleteDirs(tcb);

if(argv.p)
    return splitPics(tcb);

if(argv._.length != 1) {
    console.log(optimist.help());
    process.exit();
}

var proto = /(.+?)\/\//.exec(url)[1];

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

    var threads = {};

    getIndex(url, threads, _x(tcb, true, function(err, idx) {

        var ff = _.map(threads, function(v, threadUrl) {
            return _x(null, false, function(cb) {
                getThread(threadUrl, cb);
            });
        });

        async.parallel(ff, _x(tcb, true, function(err) {
          tcb(null, 'Forum snapshot downloaded, exit.');
        }));
    }));

}
else {

    if(argv.s)
        console.log('Working in one-shot mode.');

    getThread(url, tcb);
}

function movePics(cb) {

    fs.readdirSync('.').forEach(function(d) {

        if(/^\./.test(d) || !fs.statSync(d).isDirectory())
            return;

        fs.readdirSync(d).forEach(function(f) {

            var t = f, m;
            // undo the splitPics renaming if present
            if(m = /^\d+-(\d+\..+)$/.exec(t))
                t = m[1];

            fs.renameSync(d + '/' + f, t);
        });

        fs.rmdirSync(d);
    });

    cb();
}

function splitPics(cb) {

    var num = typeof(url) === 'number' ? url : 1000;
    var arr = shuffleArray(fs.readdirSync('.'));
    var cut, dir = 1, pfx = '';

    var digits = Math.floor(log10(arr.length / num)) + 1;
    while(digits--)
        pfx += '0';

    var cur = /\/([^\/]+)$/.exec(process.cwd())[1];

    var file = 1, pfx2 = '';
    var digits2 = Math.floor(log10(arr.length)) + 1;
    while(digits2--)
        pfx2 += '0';

    var time = Math.floor(Date.now() / 1000) - arr.length;

    while((cut = arr.splice(0, num)).length) {

        var s = String(dir++);
        s = cur + '.' + pfx.slice(s.length) + s;

        console.log('creating dir %s', s);
        fs.mkdirSync(s);

        cut.forEach(function(v) {

            var q = String(file++);
            q = pfx2.slice(q.length) + q;

            fs.utimesSync(v, time, time++);
            fs.renameSync(v, s + '/' + q + '-' + v);
        });
    }

    cb();
}

function log10(val) {
    // http://stackoverflow.com/a/3019290/448978
    return Math.log(val) / Math.LN10;
}

function shuffleArray(array) {
    // http://stackoverflow.com/a/12646864/448978
    for(var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

function deleteDirs(cb) {

    if(argv.y)
        console.log('Dry delete run, only print what would be done.');

    var minNumber = typeof(url) === 'number' ? url : 0;
    var len;

    fs.readdirSync('.').forEach(function(d) {

        if(/^\./.test(d) || !fs.statSync(d).isDirectory())
            return;

        if(d.indexOf('-') !== -1) {
            console.log('removing marked directory: ' + d);
            if(!argv.y)
                fsutil.rm_rf(d);
        }
        else if((len = fs.readdirSync(d).length) <= minNumber) {
            console.log('removing %s: %s', len === 0 ? 'empty directory' : ('directory with ' + len + ' items'), d);
            if(!argv.y)
                fsutil.rm_rf(d);
        }
    });

    cb();
}

function getIndex(url, threads, cb) { // cb(err, idx)

    console.log('Downloading page and thread index.');

    request(ua(url), _x(cb, true, function(err, res, body) {
        var idx = extractPageUrls(body, threads);
        cb(null, idx);
    }));
}

function extractPageUrls(body, links) {

    var base = url.replace(/catalog/, 'thread');

    var json = /var catalog = (.+);var style_group/.exec(body)[1]
    var doc = JSON.parse(json);

    Object.keys(doc.threads).forEach((id) => {
      links[base + '/' + id] = true;
    });

    return links;
}

console.log('press CTRL+C to exit.');

function ua(url) {
  return {
    url: url,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
    }
  }
}

function getPics(url, thread, cb) {

    request(ua(url), _x(cb, true, function(err, res, body) {

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

            var m2, m3, text = el.parent().find('div.fileText').text();
            if(text) {
                m3 = /(\d+)x(\d+)/.exec(text);
            }
            else {
                // w/h for the index image
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
        console.log(msg || 'Done.');
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

            var opts = ua(entry.url);
            opts.encoding = null;
            opts.referer = 'https://boards.4chan.org/';

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
