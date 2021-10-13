#!/usr/bin/python3
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

### directory for all HITL notes on server:
#csvDir = '/usr/local/var/www/QAQC_dashboard/HITL_notes'
csvDir = str(root_path.joinpath('QAQC_dashboard/HITL_notes').absolute())

### filter files for HITL stages
### filter keyword should include stage (Stage1, Stage2, Stage3, Sites, Platforms)
### HITL_Stage1_PCO2W.csv

csvFilter = re.compile('.*(%s).*csv'%keyWord)
#dirExtra = '/usr/local/var/www/QAQC_dashboard/'
dirExtra = str(root_path.joinpath('QAQC_dashboard/').absolute())

fileList = []
for rootdir, dirs, files in os.walk(csvDir):
	for csvFile in files:
		if csvFilter.search(csvFile):
			csvName_full = os.path.join(rootdir, csvFile)
			csvName = os.path.relpath(csvName_full, dirExtra)
			fileList.append(csvName)

fileList.sort()
fileList_json = json.dumps(fileList)

print("Content-type: text/html\n")
print(fileList_json)
