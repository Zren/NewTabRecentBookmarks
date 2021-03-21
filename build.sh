#/usr/bin/env sh

### Backup
cp ./src/manifest.json ./manifest.json
cp ./src/newtab.html ./newtab.html

### Remove debug code
sed -i '/	<script src="livereload.js"><\/script>/ d' ./src/newtab.html
mv ./src/livereload.js ./livereload.js


### Firefox
echo "[Firefox]"

# Zip
zipFilename="NewTabRecentBookmarks-firefox.xpi"
if [ -f "$zipFilename" ]; then
	rm "$zipFilename"
fi
(cd ./src && zip -r "./../${zipFilename}" ./*)


### Chrome
echo ""
echo "[Chrome]"

# Modify
python3 ./buildchrome.py

# Zip
zipFilename="NewTabRecentBookmarks-chrome.crx"
if [ -f "$zipFilename" ]; then
	rm "$zipFilename"
fi
(cd ./src && zip -r "./../${zipFilename}" ./*)



### Restore
mv ./manifest.json ./src/manifest.json
mv ./newtab.html ./src/newtab.html
mv ./livereload.js ./src/livereload.js
