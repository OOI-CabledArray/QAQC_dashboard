from pydrive2.auth import GoogleAuth
from pydrive2.drive import GoogleDrive

import pandas as pd
import requests
import io

# Create local webserver and auto handle authentication.
gauth = GoogleAuth()
gauth.LocalWebserverAuth() 

# Create GoogleDrive instance with authenticated GoogleAuth instance
drive = GoogleDrive(gauth)

# Read Gdrive directory for sensor folders 
HITL_fileID = '10t3thgMA40ONuNpsOgdcRxddlhRP-gimogs_YO9DQqg'
sheetIDsFile = 'params/HITLsheetIDs.csv'
sheetIDs = sheetIDs = pd.read_csv(sheetIDsFile, header=None, index_col=0, squeeze=True).to_dict()

# Download all sensor tabs in HITL Data QA/QC Log google spreadsheet in Google Spreadsheet as csv files

df_HITL = pd.DataFrame()
for sensor in sheetIDs.keys():
    url = 'https://docs.google.com/spreadsheets/d/' + HITL_fileID + '/gviz/tq?tqx=out:csv&gid=' + str(sheetIDs[sensor])
    headers = {'Authorization': 'Bearer ' + gauth.credentials.access_token}
    res = requests.get(url, headers=headers).content
    df = pd.read_csv(io.StringIO(res.decode('utf-8')),index_col=False)
    for col in df.columns:
        if 'Unnamed' in col:
            del df[col]
    df_HITL = df_HITL.append(df.transpose())
 
df_HITL = df_HITL.apply(lambda x: x.str.replace(',','.'))

# Generate HITL status tables:
# by Stage:
plotPages = {}
plotPages['Stage1'] = ['ADCP', 'BOTPT', 'CTD', 'DOFSTA', 'DOSTA', 'FLCDR','FLORT','FLNTU',
          'FLOR','NUTNR', 'PARAD', 'PHSEN', 'PCO2W', 'SPKIR', 'VELPT']

plotPages['Stage2'] = ['CAMHD','OPTAA','PREST','THSPH','TMPSF','TRHPH','VEL3D','ZPLSC']
plotPages['Stage3'] = ['CAMDS','HPIES','HYDBB','HYDLF','MASSP','OBSBB','OBSSP']
plotPages['Stage4'] = ['FLOBNC','FLOBNM','OSMOIA','PPS','RAS','D1000']

# by Site: 
plotPages['Sites'] = ['CEO2SHBP', 'CE04OSBP', 'CE04OSPD', 'CE04OSPS', 'RS01SBPD', 'RS01SBPS', 'RS01SLBS',
         'RS01SUM1', 'RS01SUM2', 'RS03AXBS', 'RS03AXPD', 'RS03AXPS', 'RS03INT1', 'RS03INT2',
         'RS03CCAL', 'RS03ECAL', 'RS03ASHS']

# by Platform
plotPages['Platforms'] = { 'BEP':['BP'], 'Deep-Profiler':['DP0'],'Shallow-Profiler':['SF0'],
             'Shallow-Profiler-200m_Platform':['PC0'], 
             'Seafloor':['SLBS','SUM1','SUM2','AXBS','INT1','INT2','CCAL','ECAL','ASHS']} 

for page in plotPages.keys():
    for item in plotPages[page]:
        if any(ele in page for ele in ['Stage','Sites']):
            df_logList = df_HITL[df_HITL.index.str.contains(item)]
        elif 'Platforms' in page:
            df_logList = df_HITL[df_HITL.index.str.contains('|'.join(plotPages[page][item]))]
        if not df_logList.empty:
            # only keep the first column (most recent note)
            df_logList = df_logList.iloc[:, 0] 
            csvTable = df_logList.to_csv(header=False)
            f = open('HITL_notes/' + 'HITL_' + page + '_' + item + '.csv','w')
            f.write(csvTable)
            f.close()
            
