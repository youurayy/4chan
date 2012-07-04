# 4chan picture downloader

## Usage

Install Node.js if you don't have it yet. Then from the command line:
	
	[sudo] npm install 4chan -g

Then proceed as follows:
	
	mkdir directory
	cd directory
	4chan http://boards.4chan.org/o/res/6487606

When the downloading finishes, the tool will keep monitoring the thread for new pictures, and download them as they appear, until the thread is removed. Press `Ctrl+C` to quit the tool. Use the option `-s` (--single-shot) to prevent this behavior and only donwload the existing images.

Call the program with the `--help` option to see more options.

## Warning

4chan is an anonymous board and from time to time, on some of its forums (e.g. `/b/`), users upload illegal content, downloading of which may implicate you in a criminal investigation. Moderators of 4chan are promptly deleting such content from the forum, but when you download images in bulk, it may happen that this illegal content ends up on your harddrive.
When the 4chan downloader tool, while checking for thread updates, registers that an image was deleted from the thread, it will attempt to delete it from your harddrive. This will of course not happen if you quit the tool prematurely using Ctrl+C.
On the unsafe forums, the safest way is to inspect the thread before you run the downloading tool, and only running the tool with the one-shot switch (`-s`).


## License
(The MIT License)

Copyright (c) 2012 Juraj Vitko (http://ypocat.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.