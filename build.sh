#/usr/bin/env sh

projectName="NewTabRecentBookmarks"

### Backup
cp ./src/manifest.json ./manifest.json
cp ./src/newtab.html ./newtab.html

### Remove debug code
sed -i '/	<script src="livereload.js"><\/script>/ d' ./src/newtab.html


### Firefox
echo "[Firefox]"

# Modify
python3 ./preparebuild_firefox.py

# Zip
zipFilename="${projectName}-firefox.xpi"
if [ -f "$zipFilename" ]; then
	rm "$zipFilename"
fi
(cd ./src && zip \
	-x "livereload.js" \
	-r \
	"./../${zipFilename}" \
	./* \
)


### Chrome
echo ""
echo "[Chrome]"

# Modify
python3 ./preparebuild_chrome.py

# Zip
zipFilename="${projectName}-chrome.crx"
if [ -f "$zipFilename" ]; then
	rm "$zipFilename"
fi
(cd ./src && zip \
	-x "faviconcacher.js" \
	-x "livereload.js" \
	-r \
	"./../${zipFilename}" \
	./* \
)



### Restore
mv ./manifest.json ./src/manifest.json
mv ./newtab.html ./src/newtab.html
