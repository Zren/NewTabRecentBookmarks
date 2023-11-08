#!/usr/bin/env python3

import json

# Overwrite with firefox changes
with open('./src/manifest.json', 'r') as fin:
	manifest = json.load(fin)

manifest['manifest_version'] = 2

manifest['background'] = {
	"scripts": [
		"faviconcacher.js"
	]
}

manifest['chrome_settings_overrides'] = {
	"homepage": "newtab.html"
}

if 'favicon' in manifest['permissions']:
	manifest['permissions'].remove('favicon')

if 'tabs' not in manifest['permissions']:
	manifest['permissions'].append('tabs')

with open('./src/manifest.json', 'w') as fout:
	json.dump(manifest, fout, indent='\t')
