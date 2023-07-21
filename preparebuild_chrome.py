#!/usr/bin/env python3

import json

# Overwrite with chrome changes
with open('./src/manifest.json', 'r') as fin:
	manifest = json.load(fin)

if 'background' in manifest:
	del manifest['background']

if 'chrome_settings_overrides' in manifest:
	del manifest['chrome_settings_overrides']

if 'tabs' in manifest['permissions']:
	manifest['permissions'].remove('tabs')

if 'chrome://favicon/' not in manifest['permissions']:
	manifest['permissions'].append('chrome://favicon/')

with open('./src/manifest.json', 'w') as fout:
	json.dump(manifest, fout, indent='\t')
