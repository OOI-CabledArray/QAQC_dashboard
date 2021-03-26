#!/usr/bin/python
# -*- coding: utf-8 -*-

# import packages
import json
import os
import re
import sys
import cgi, cgitb
from pathlib import Path

form = cgi.FieldStorage()

keyWord = form.getvalue('keyWord')

here = Path(__file__).parent.absolute()
root_path = here.parent.absolute()

### directory for all QAQC plots on server:
# plotDir = '/usr/local/var/www/QAQC_dashboard/QAQC_plots'
plotDir = str(root_path.joinpath('QAQC_dashboard/QAQC_plots').absolute())

### filter plots for default view: 1 week time period, no overlays, full range
### filter keyword should be either refDes or sensor
###CE02SHBP-LJ01D-06-CTDBPN106_CTDtemperature_week_none_full

plotFilter = re.compile('.*(%s).*_week_none_full.png'%keyWord)
# dirExtra = '/usr/local/var/www/QAQC_dashboard/'
dirExtra = str(root_path.joinpath('QAQC_dashboard/').absolute())

fileList = []
for rootdir, dirs, files in os.walk(plotDir):
	for plotFile in files:
		if plotFilter.search(plotFile):
			imageName_full = os.path.join(rootdir, plotFile)
			imageName = os.path.relpath(imageName_full, dirExtra)
			fileList.append(imageName)

#fileList = [x for x in os.listdir('/usr/local/var/www/QAQC_dashboard/QAQC_plots') if plotFilter.search(x)]
fileList.sort()
fileList_json = json.dumps(fileList)

print("Content-type: text/html\n")
print(fileList_json)