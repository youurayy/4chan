# 4chan picture downloader

## Usage

Install Node.js if you don't have it yet. Then from the command line:

	[sudo] npm install 4chan -g

Then proceed as follows:

	mkdir directory
	cd directory
	4chan http://boards.4chan.org/o/res/6487606

When the downloading finishes, the tool will keep monitoring the thread for new pictures, and download them as they appear, until the thread is removed. Press `Ctrl+C` to quit the tool. Use the option `-s` (`--single-shot`) to prevent this behavior and only donwload the existing images.

Call the program with the `--help` option to see more options, like filtering based on image dimensions, gif/non-gif format, and categorization of images into landscape and portrait subdirectories for easier mobile viewing.
