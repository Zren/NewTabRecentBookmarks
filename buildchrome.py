#!/usr/bin/env python3

import json

# Overwrite with chrome changes
with open('./src/manifest.json', 'r') as fin:
	manifest = json.load(fin)

manifest['permissions'].append('chrome://favicon/')

with open('./src/manifest.json', 'w') as fout:
	json.dump(manifest, fout, indent='\t')
