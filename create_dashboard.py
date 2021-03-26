import xarray as xr
import pandas as pd
import psutil
from datetime import datetime, timedelta
from dateutil import parser
import numpy as np
import os
import gc
import statistics as st
import re
import argparse

import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import matplotlib.lines as mlines
from matplotlib.cm import ScalarMappable
import matplotlib.colors as colors
from matplotlib.colors import ListedColormap
from scipy.interpolate import griddata
import cmocean
import fsspec

import concurrent.futures
from pathlib import Path

PARAMS_DIR = Path('params')
CLIMATOLOGY_TABLES = Path('climatologyTables')
PLOT_DIR = Path('QAQCplots')

# Always make sure it gets created
PLOT_DIR.mkdir(exist_ok=True)

selection_mapping = {'profiler': 'CTD-PROFILER', 'fixed': 'CTD-FIXED'}


# create dictionary of sites key for filePrefix, nearestNeighbors
sites_dict = (
    pd.read_csv(PARAMS_DIR.joinpath('sitesDictionaryPanel.csv'))
    .set_index('refDes')
    .T.to_dict('series')
)

# create dictionary of parameter vs variable Name
variable_dict = pd.read_csv(
    PARAMS_DIR.joinpath('variableMap.csv'), index_col=0, squeeze=True
).to_dict()

# create dictionary of instrumet key for plot parameters
instrument_dict = (
    pd.read_csv(PARAMS_DIR.joinpath('plotParameters.csv'))
    .set_index('instrument')
    .T.to_dict('series')
)

# create dictionary of variable parameters for plotting
variable_paramDict = (
    pd.read_csv(PARAMS_DIR.joinpath('variableParameters.csv'))
    .set_index('variable')
    .T.to_dict('series')
)

plotDir = str(PLOT_DIR) + '/'

lineColors = [
    '#1f78b4',
    '#a6cee3',
    '#b2df8a',
    '#33a02c',
    '#fb9a99',
    '#e31a1c',
    '#fdbf6f',
    '#ff7f00',
]
balanceBig = plt.get_cmap('cmo.balance', 512)
balanceBlue = ListedColormap(balanceBig(np.linspace(0, 0.5, 256)))


def map_concurrency(
    func, iterator, func_args=(), func_kwargs={}, max_workers=10
):
    results = []
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=max_workers
    ) as executor:
        # Start the load operations and mark each future with its URL
        future_to_url = {
            executor.submit(func, i, *func_args, **func_kwargs): i
            for i in iterator
        }
        for future in concurrent.futures.as_completed(future_to_url):
            data = future.result()
            results.append(data)
    return results


def extractClim(profileDepth, overlayData_clim, timeRef):

    depth = float(profileDepth)
    bracketList = [x for x in overlayData_clim.keys() if x <= depth]
    if bracketList:
        bracket = min(bracketList, key=lambda x: abs(x - depth))

        climTime = []
        climMinus3std = []
        climPlus3std = []
        climData = []
        for i in range(1, 13):
            # current year
            climTime.append(datetime(timeRef.year, i, 15))
            climMinus3std.append(overlayData_clim[bracket][i]['climMinus3std'])
            climPlus3std.append(overlayData_clim[bracket][i]['climPlus3std'])
            climData.append(overlayData_clim[bracket][i]['clim'])
            # extend climatology to previous year
            climTime.append(datetime(timeRef.year - 1, i, 15))
            climMinus3std.append(overlayData_clim[bracket][i]['climMinus3std'])
            climPlus3std.append(overlayData_clim[bracket][i]['climPlus3std'])
            climData.append(overlayData_clim[bracket][i]['clim'])
            # extend climatology to next year
            climTime.append(datetime(timeRef.year + 1, i, 15))
            climMinus3std.append(overlayData_clim[bracket][i]['climMinus3std'])
            climPlus3std.append(overlayData_clim[bracket][i]['climPlus3std'])
            climData.append(overlayData_clim[bracket][i]['clim'])

        zipped = zip(climTime, climMinus3std, climPlus3std, climData)
        zipped = list(zipped)
        sortClim = sorted(zipped, key=lambda x: x[0])

        climSeries = pd.DataFrame(
            sortClim,
            columns=['climTime', 'climMinus3std', 'climPlus3std', 'climData'],
        )
        climSeries.set_index(['climTime'], inplace=True)

        # upsampled_day = climSeries.resample('D')
        # climInterpolated_day = upsampled_day.interpolate(method='linear')

        upsampled_hour = climSeries.resample('H')
        climInterpolated_hour = upsampled_hour.interpolate(method='linear')

    else:
        climInterpolated_hour = pd.DataFrame()

    return climInterpolated_hour


def loadClim(site):
    def cleanDataframe(dfString):
        m = re.match('\[(.*\d),.*\d\]', dfString)
        if m:
            cleanString = m.group(1)
            return cleanString
        else:
            return dfString

    climatologyDir = 'climatologyTables/'
    param = 'seawater_temperature'
    clim_dict = {}

    climFiles = []
    for rootdir, dirs, files in os.walk(climatologyDir):
        for climFile in files:
            if (site in climFile) and (param in climFile):
                climFile_full = os.path.join(rootdir, climFile)
                climFiles.append(climFile_full)

    if len(climFiles) != 1:
        print('error finding climatology file!')
    else:
        param_clim = pd.read_csv(climFiles[0])
        param_clim.rename(columns={'Unnamed: 0': 'depth'}, inplace=True)
        param_clim['depth'] = param_clim['depth'].apply(cleanDataframe)
        param_clim = param_clim.rename(columns=lambda x: cleanDataframe(x))

        for index, row in param_clim.iterrows():
            depthKey = int(row.depth)
            clim_dict[depthKey] = {}
            for i in range(1, 13):
                clim_dict[depthKey][i] = {}
                climRange = row[i].replace('[', '').replace(']', '').split(',')
                clim_dict[depthKey][i]['climMinus3std'] = float(climRange[0])
                clim_dict[depthKey][i]['climPlus3std'] = float(climRange[1])
                clim = st.mean([float(climRange[0]), float(climRange[1])])
                clim_dict[depthKey][i]['clim'] = clim

    return clim_dict


def loadData(site):
    zarrDir = 's3://ooi-data/' + sites_dict[site]['zarrFile']
    zarr_store = fsspec.get_mapper(zarrDir, anon=True)
    # TODO: only request parameters listed in sites_dict[site][dataParameters]?
    # requestParams = sites_dict[site]['dataParameters'].strip('"').split(',')
    ds = xr.open_dataset(
        zarr_store,
        engine='zarr',
        backend_kwargs=dict(consolidated=True),
        chunks={'time': 13106200},
    )

    return ds


def plotProfilesGrid(
    paramData,
    plotTitle,
    zLabel,
    timeRef,
    yMin,
    yMax,
    zMin,
    zMax,
    colorMap,
    fileName_base,
    overlayData_clim,
    overlayData_near,
    Yparam,
):
    def setPlot():

        plt.close('all')
        plt.rcParams["font.family"] = "serif"

        fig, ax = plt.subplots()
        fig.set_size_inches(5.65, 1.75)
        fig.patch.set_facecolor('white')
        plt.title(plotTitle, fontsize=4, loc='left')
        plt.ylabel('Pressure (dbar)', fontsize=4)
        ax.tick_params(direction='out', length=2, width=0.5, labelsize=4)
        ax.ticklabel_format(useOffset=False)
        locator = mdates.AutoDateLocator()
        formatter = mdates.ConciseDateFormatter(locator)
        formatter.formats = [
            '%y',  # ticks are mostly years
            '%b',  # ticks are mostly months
            '%m/%d',  # ticks are mostly days
            '%H h',  # hrs
            '%H:%M',  # min
            '%S.%f',
        ]  # secs
        formatter.zero_formats = [
            '',  # ticks are mostly years, no need for zero_format
            '%b-%Y',  # ticks are mostly months, mark month/year
            '%m/%d',  # ticks are mostly days, mark month/year
            '%m/%d',  # ticks are mostly hours, mark month and day
            '%H',  # ticks are montly mins, mark hour
            '%M',
        ]  # ticks are mostly seconds, mark minute

        formatter.offset_formats = ['', '', '', '', '', '']

        ax.xaxis.set_major_locator(locator)
        ax.xaxis.set_major_formatter(formatter)
        ax.grid(False)
        ax.invert_yaxis()
        return (fig, ax)

    def calc_TS(dt64):
        unix_epoch = np.datetime64(0, 's')
        one_second = np.timedelta64(1, 's')
        return (dt64 - unix_epoch) / one_second

    endDate = timeRef
    for span in spans:
        print('plotting timeSpan: ', span)
        if psutil.virtual_memory().percent > 80.0:
            print(
                f"WARNING: MEMORY USAGE IS MORE THAN 80% ({psutil.virtual_memory().percent})"  # noqa
            )
        startDate = timeRef - timedelta(days=int(span))
        xMin = startDate - timedelta(days=int(span) * 0.002)
        xMax = endDate + timedelta(days=int(span) * 0.002)
        baseDS = paramData.sel(time=slice(startDate, endDate))
        scatterX = baseDS.time
        scatterY = baseDS.seawater_pressure
        scatterZ = baseDS[Yparam]
        fig, ax = setPlot()

        if scatterX.size != 0:
            # create interpolation grid
            xMinTimestamp = xMin.timestamp()
            xMaxTimestamp = xMax.timestamp()
            xi = np.arange(xMinTimestamp, xMaxTimestamp, 3600)
            yi = np.arange(yMin, yMax, 0.5)
            xi, yi = np.meshgrid(xi, yi)

            scatterX_TS = scatterX.pipe(calc_TS)

            # interpolate data to data
            zi = griddata(
                (scatterX_TS, scatterY), scatterZ, (xi, yi), method='linear'
            )
            xiDT = xi.astype('datetime64[s]')
            # mask out any time gaps greater than 1 day
            timeGaps = np.where(np.diff(scatterX_TS) > 86400)
            if len(timeGaps[0]) > 1:
                gaps = timeGaps[0]
                for gap in gaps:
                    gapMask = (xi > scatterX_TS[gap].data) & (
                        xi < scatterX_TS[gap + 1].data
                    )
                    zi[gapMask] = np.nan

            # plot filled contours
            profilePlot = plt.contourf(xiDT, yi, zi, 50, cmap=colorMap)
            emptySlice = 'no'
        else:
            print('slice is empty!')
            profilePlot = plt.scatter(
                scatterX, scatterY, c=scatterZ, marker='.', cmap=colorMap
            )
            plt.annotate(
                'No data available', xy=(0.3, 0.5), xycoords='axes fraction'
            )
            emptySlice = 'yes'

        plt.xlim(xMin, xMax)
        cbar = fig.colorbar(profilePlot, ax=ax)
        cbar.update_ticks()
        cbar.formatter.set_useOffset(False)
        cbar.ax.set_ylabel(zLabel, fontsize=4)
        cbar.ax.tick_params(length=2, width=0.5, labelsize=4)

        fileName = fileName_base + '_' + spanString[span] + '_' + 'none'
        fig.savefig(fileName + '_full.png', dpi=300)
        cbar.remove()
        plt.clim(zMin, zMax)
        m = ScalarMappable(cmap=profilePlot.get_cmap())
        m.set_array(profilePlot.get_array())
        m.set_clim(profilePlot.get_clim())
        cbar = fig.colorbar(m, ax=ax)
        cbar.update_ticks()
        cbar.formatter.set_useOffset(False)
        cbar.ax.set_ylabel(zLabel, fontsize=4)
        cbar.ax.tick_params(length=2, width=0.5, labelsize=4)
        fig.savefig(fileName + '_local.png', dpi=300)

        if 'no' in emptySlice:
            for overlay in overlays:
                if 'clim' in overlay:
                    fig, ax = setPlot()
                    if overlayData_clim:
                        depthList = []
                        timeList = []
                        climList = []
                        for key in overlayData_clim:
                            for subKey in overlayData_clim[key]:
                                climList.append(
                                    overlayData_clim[key][subKey]['clim']
                                )
                                depthList.append(key)
                                timeList.append(
                                    np.datetime64(
                                        "{0}-{1}-{2}".format(
                                            str(timeRef.year),
                                            str(subKey).zfill(2),
                                            15,
                                        ),
                                        'D',
                                    )
                                )
                                # extend climatology to previous year
                                climList.append(
                                    overlayData_clim[key][subKey]['clim']
                                )
                                depthList.append(key)
                                timeList.append(
                                    np.datetime64(
                                        "{0}-{1}-{2}".format(
                                            str(timeRef.year - 1),
                                            str(subKey).zfill(2),
                                            15,
                                        ),
                                        'D',
                                    )
                                )
                                # extend climatology to next year
                                climList.append(
                                    overlayData_clim[key][subKey]['clim']
                                )
                                depthList.append(key)
                                timeList.append(
                                    np.datetime64(
                                        "{0}-{1}-{2}".format(
                                            str(timeRef.year + 1),
                                            str(subKey).zfill(2),
                                            15,
                                        ),
                                        'D',
                                    )
                                )

                        climTime_TS = np.apply_along_axis(calc_TS, 0, timeList)
                        # interpolate climatology data
                        clim_zi = griddata(
                            (climTime_TS, depthList),
                            climList,
                            (xi, yi),
                            method='linear',
                        )
                        climDiff = zi - clim_zi
                        maxLim = max(
                            abs(np.nanmin(climDiff)), abs(np.nanmax(climDiff))
                        )
                        # plot filled contours
                        profilePlot = plt.contourf(
                            xiDT,
                            yi,
                            climDiff,
                            50,
                            cmap='cmo.balance',
                            vmin=-maxLim,
                            vmax=maxLim,
                        )
                        plt.clim(-maxLim, maxLim)
                        m = ScalarMappable(cmap=profilePlot.get_cmap())
                        m.set_array(profilePlot.get_array())
                        m.set_clim(profilePlot.get_clim())
                        cbar = fig.colorbar(m, ax=ax)
                        cbar.update_ticks()
                        cbar.formatter.set_useOffset(False)
                        cbar.ax.set_ylabel(zLabel, fontsize=4)
                        cbar.ax.tick_params(length=2, width=0.5, labelsize=4)
                        plt.xlim(xMin, xMax)

                        fileName = (
                            fileName_base
                            + '_'
                            + spanString[span]
                            + '_'
                            + 'clim'
                        )
                        fig.savefig(fileName + '_full.png', dpi=300)

                        climDiffMin = np.nanmin(climDiff)
                        climDiffMax = np.nanmax(climDiff)
                        if climDiffMax < 0:
                            climDiffMax = 0
                            colorMapLocal = balanceBlue
                            divColor = 'no'
                        elif climDiffMin > 0:
                            climDiffMin = 0
                            colorMapLocal = 'cmo.amp'
                            divColor = 'no'
                        else:
                            colorMapLocal = 'cmo.balance'
                            divColor = 'yes'

                        fig, ax = setPlot()
                        if 'yes' in divColor:
                            divnorm = colors.TwoSlopeNorm(
                                vmin=climDiffMin, vcenter=0, vmax=climDiffMax
                            )
                            profilePlot = plt.contourf(
                                xiDT,
                                yi,
                                climDiff,
                                50,
                                cmap=colorMapLocal,
                                vmin=climDiffMin,
                                vmax=climDiffMax,
                                norm=divnorm,
                            )
                            cbar = fig.colorbar(profilePlot, ax=ax)
                        else:
                            profilePlot = plt.contourf(
                                xiDT,
                                yi,
                                climDiff,
                                50,
                                cmap=colorMapLocal,
                                vmin=climDiffMin,
                                vmax=climDiffMax,
                            )

                            plt.clim(climDiffMin, climDiffMax)
                            m = ScalarMappable(cmap=profilePlot.get_cmap())
                            m.set_array(profilePlot.get_array())
                            m.set_clim(profilePlot.get_clim())
                            cbar = fig.colorbar(m, ax=ax)

                        cbar.update_ticks()
                        cbar.formatter.set_useOffset(False)
                        cbar.ax.set_ylabel(zLabel, fontsize=4)
                        cbar.ax.tick_params(length=2, width=0.5, labelsize=4)
                        plt.xlim(xMin, xMax)

                        fig.savefig(fileName + '_local.png', dpi=300)

                    else:
                        print('climatology is empty!')
                        # profilePlot = plt.scatter(scatterX, scatterY,
                        # c=scatterZ, marker = '.', cmap = 'cmo.balance')
                        plt.annotate(
                            'No climatology data available',
                            xy=(0.3, 0.5),
                            xycoords='axes fraction',
                        )
                        plt.xlim(xMin, xMax)

                        cbar = fig.colorbar(profilePlot, ax=ax)
                        cbar.update_ticks()
                        cbar.formatter.set_useOffset(False)
                        cbar.ax.set_ylabel(zLabel, fontsize=4)
                        cbar.ax.tick_params(length=2, width=0.5, labelsize=4)

                        fileName = (
                            fileName_base
                            + '_'
                            + spanString[span]
                            + '_'
                            + 'clim'
                        )
                        fig.savefig(fileName + '_full.png', dpi=300)
                        fig.savefig(fileName + '_local.png', dpi=300)

        else:
            profilePlot = plt.scatter(
                scatterX, scatterY, c=scatterZ, marker='.', cmap='cmo.balance'
            )
            plt.annotate(
                'No data available', xy=(0.3, 0.5), xycoords='axes fraction'
            )
            plt.xlim(xMin, xMax)
            cbar = fig.colorbar(profilePlot, ax=ax)
            cbar.update_ticks()
            cbar.formatter.set_useOffset(False)
            cbar.ax.set_ylabel(zLabel, fontsize=4)
            cbar.ax.tick_params(length=2, width=0.5, labelsize=4)
            fileName = fileName_base + '_' + spanString[span] + '_' + 'clim'
            fig.savefig(fileName + '_full.png', dpi=300)
            fig.savefig(fileName + '_local.png', dpi=300)


def plotScatter(
    paramData,
    plotTitle,
    yLabel,
    timeRef,
    yMin,
    yMax,
    fileName_base,
    overlayData_clim,
    overlayData_near,
    plotMarkerSize,
):
    def setPlot():

        plt.close('all')
        plt.rcParams["font.family"] = "serif"

        fig, ax = plt.subplots()
        fig.set_size_inches(4.5, 1.75)
        fig.patch.set_facecolor('white')
        plt.title(plotTitle, fontsize=4, loc='left')
        plt.ylabel(yLabel, fontsize=4)
        ax.tick_params(direction='out', length=2, width=0.5, labelsize=4)
        ax.ticklabel_format(useOffset=False)
        locator = mdates.AutoDateLocator()
        formatter = mdates.ConciseDateFormatter(locator)
        formatter.formats = [
            '%y',  # ticks are mostly years
            '%b',  # ticks are mostly months
            '%m/%d',  # ticks are mostly days
            '%H h',  # hrs
            '%H:%M',  # min
            '%S.%f',
        ]  # secs
        formatter.zero_formats = [
            '',  # ticks are mostly years, no need for zero_format
            '%b-%Y',  # ticks are mostly months, mark month/year
            '%m/%d',  # ticks are mostly days, mark month/year
            '%m/%d',  # ticks are mostly hours, mark month and day
            '%H',  # ticks are montly mins, mark hour
            '%M',
        ]  # ticks are mostly seconds, mark minute

        formatter.offset_formats = ['', '', '', '', '', '']

        ax.xaxis.set_major_locator(locator)
        ax.xaxis.set_major_formatter(formatter)
        ax.grid(False)
        return (fig, ax)

    endDate = timeRef
    for span in spans:
        print('plotting timeSpan: ', span)
        startDate = timeRef - timedelta(days=int(span))
        xMin = startDate - timedelta(days=int(span) * 0.002)
        xMax = endDate + timedelta(days=int(span) * 0.002)
        baseDS = paramData.sel(time=slice(startDate, endDate))
        scatterX = baseDS.time.values
        scatterY = baseDS.values
        fig, ax = setPlot()
        emptySlice = 'no'
        if 'large' in plotMarkerSize:
            plt.plot(
                scatterX, scatterY, '.', color=lineColors[0], markersize=2
            )
        elif 'medium' in plotMarkerSize:
            plt.plot(
                scatterX, scatterY, '.', color=lineColors[0], markersize=0.75
            )
        elif 'small' in plotMarkerSize:
            plt.plot(scatterX, scatterY, ',', color=lineColors[0])
        plt.xlim(xMin, xMax)
        # ylim_current = plt.gca().get_ylim()
        if scatterX.size == 0:
            print('slice is empty!')
            plt.annotate(
                'No data available', xy=(0.3, 0.5), xycoords='axes fraction'
            )
            emptySlice = 'yes'
        fileName = fileName_base + '_' + spanString[span] + '_' + 'none'
        fig.savefig(fileName + '_full.png', dpi=300)
        plt.ylim(yMin, yMax)
        fig.savefig(fileName + '_local.png', dpi=300)

        for overlay in overlays:
            if 'time' in overlay:
                fig, ax = setPlot()
                plt.xlim(xMin, xMax)
                # plot previous 6 years of data slices for timespan
                print('adding time machine plot')
                # TODO: make this a smarter iterator about
                # how many years of data exist...
                numYears = 6
                for z in range(0, numYears):
                    timeRef_year = timeRef - timedelta(days=z * 365)
                    time_startDate = timeRef_year - timedelta(days=int(span))
                    time_endDate = timeRef_year
                    timeDS = paramData.sel(
                        time=slice(time_startDate, time_endDate)
                    )
                    timeDS['plotTime'] = timeDS.time + np.timedelta64(
                        timedelta(days=365 * z)
                    )
                    timeX = timeDS.plotTime.data
                    timeY = timeDS.data
                    c = lineColors[z]
                    if 'large' in plotMarkerSize:
                        plt.plot(
                            timeX,
                            timeY,
                            '.',
                            markersize=2,
                            c=c,
                            label='%s' % str(timeRef_year.year),
                        )
                    elif 'medium' in plotMarkerSize:
                        plt.plot(
                            timeX,
                            timeY,
                            '.',
                            markersize=0.75,
                            c=c,
                            label='%s' % str(timeRef_year.year),
                        )
                    elif 'small' in plotMarkerSize:
                        plt.plot(
                            timeX,
                            timeY,
                            ',',
                            c=c,
                            label='%s' % str(timeRef_year.year),
                        )
                    del timeDS
                    gc.collect()

                # generating custom legend
                handles, labels = ax.get_legend_handles_labels()
                patches = []
                for handle, label in zip(handles, labels):
                    patches.append(
                        mlines.Line2D(
                            [],
                            [],
                            color=handle.get_color(),
                            marker='o',
                            markersize=1,
                            linewidth=0,
                            label=label,
                        )
                    )

                # legend = ax.legend(
                #     handles=patches, loc="upper right", fontsize=3
                # )
                fileName = (
                    fileName_base + '_' + spanString[span] + '_' + overlay
                )
                fig.savefig(fileName + '_full.png', dpi=300)
                plt.ylim(yMin, yMax)
                fig.savefig(fileName + '_local.png', dpi=300)

            if 'clim' in overlay:
                # add climatology trace
                print('adding climatology trace to plot')
                if 'no' in emptySlice:
                    fig, ax = setPlot()
                    plt.xlim(xMin, xMax)
                    if not overlayData_clim.empty:
                        if 'large' in plotMarkerSize:
                            plt.plot(
                                scatterX,
                                scatterY,
                                '.',
                                color=lineColors[0],
                                markersize=2,
                            )
                        elif 'medium' in plotMarkerSize:
                            plt.plot(
                                scatterX,
                                scatterY,
                                '.',
                                color=lineColors[0],
                                markersize=0.75,
                            )
                        elif 'small' in plotMarkerSize:
                            plt.plot(
                                scatterX, scatterY, ',', color=lineColors[0]
                            )

                        plt.fill_between(
                            overlayData_clim.index,
                            overlayData_clim.climMinus3std,
                            overlayData_clim.climPlus3std,
                            alpha=0.2,
                        )
                        plt.plot(
                            overlayData_clim.climData,
                            '-.',
                            color='r',
                            alpha=0.4,
                            linewidth=0.25,
                        )
                    else:
                        print('Climatology is empty!')
                        plt.annotate(
                            'No climatology data available',
                            xy=(0.3, 0.5),
                            xycoords='axes fraction',
                        )

                    fileName = (
                        fileName_base + '_' + spanString[span] + '_' + 'clim'
                    )
                    fig.savefig(fileName + '_full.png', dpi=300)
                    plt.ylim(yMin, yMax)
                    fig.savefig(fileName + '_local.png', dpi=300)

            if 'near' in overlay:
                # add nearest neighbor data traces
                print('adding nearest neighbor data to plot')


def create_plot_for_depth(
    profileDepth,
    paramData,
    Yparam,
    pressParam,
    plotTitle,
    imageName_base,
    overlayData_clim,
    yLabel,
    profile_paramMin,
    profile_paramMax,
    overlayData_near,
    timeRef,
):
    print(f"Depth: {profileDepth}")
    paramData_depth = paramData[Yparam].where(
        (int(profileDepth) < paramData[pressParam])
        & (paramData[pressParam] < (int(profileDepth) + 0.5))
    )
    plotTitle_depth = plotTitle + ': ' + profileDepth + ' meters'
    imageName_base_depth = imageName_base + '_' + profileDepth + 'meters'
    if overlayData_clim:
        overlayData_clim_extract = extractClim(profileDepth, overlayData_clim)
    else:
        overlayData_clim_extract = pd.DataFrame()
    plotScatter(
        paramData_depth,
        plotTitle_depth,
        yLabel,
        timeRef,
        profile_paramMin,
        profile_paramMax,
        imageName_base_depth,
        overlayData_clim_extract,
        overlayData_near,
        'medium',
    )


def run_dashboard_creation(site, paramList, timeRef, depth_workers=3):
    now = datetime.utcnow()
    print('site: ', site)
    # load data for site
    siteData = loadData(site)
    fileParams = sites_dict[site]['dataParameters'].strip('"').split(',')
    for param in paramList:
        print('paramater: ', param)
        variableParams = variable_dict[param].strip('"').split(',')
        parameterList = [
            value for value in variableParams if value in fileParams
        ]
        if len(parameterList) != 1:
            print('Error retrieving parameter name...')
        else:
            Yparam = parameterList[0]
            # set up plotting parameters
            imageName_base = plotDir + site + '_' + param
            plotTitle = site + ' ' + param
            paramMin = variable_paramDict[param]['min']
            paramMax = variable_paramDict[param]['max']
            profile_paramMin = variable_paramDict[param]['profileMin']
            profile_paramMax = variable_paramDict[param]['profileMax']
            yLabel = variable_paramDict[param]['label']

            # Load overlayData
            overlayData_clim = {}
            overlayData_clim = loadClim(site)
            overlayData_near = {}
            # overlayData_near = loadNear(site)

            if 'PROFILER' in plotInstrument:
                # TODO extract profiles???
                profile_paramMin = variable_paramDict[param]['profileMin']
                profile_paramMax = variable_paramDict[param]['profileMax']
                pressureParams = (
                    variable_dict['pressure'].strip('"').split(',')
                )
                pressureParamList = [
                    value for value in pressureParams if value in fileParams
                ]
                if len(pressureParamList) != 1:
                    print('Error retrieving pressure parameter!')
                else:
                    pressParam = pressureParamList[0]
                    paramData = siteData[[Yparam, pressParam]]
                    colorMap = 'cmo.' + variable_paramDict[param]['colorMap']
                    # plotProfiles(paramData,plotTitle,yLabel,timeRef,paramMin,paramMax,colorMap,imageName_base,overlayData)
                    depthMinMax = (
                        sites_dict[site]['depthMinMax'].strip('"').split(',')
                    )
                    if 'None' not in depthMinMax:
                        yMin = int(depthMinMax[0])
                        yMax = int(depthMinMax[1])
                    plotProfilesGrid(
                        paramData,
                        plotTitle,
                        yLabel,
                        timeRef,
                        yMin,
                        yMax,
                        profile_paramMin,
                        profile_paramMax,
                        colorMap,
                        imageName_base,
                        overlayData_clim,
                        overlayData_near,
                        Yparam,
                    )
                    depths = sites_dict[site]['depths'].strip('"').split(',')
                    if 'Single' not in depths:
                        map_concurrency(
                            create_plot_for_depth,
                            depths,
                            func_args=(
                                paramData,
                                Yparam,
                                pressParam,
                                plotTitle,
                                imageName_base,
                                overlayData_clim,
                                yLabel,
                                profile_paramMin,
                                profile_paramMax,
                                overlayData_near,
                            ),
                            max_workers=depth_workers,
                        )
            else:
                paramData = siteData[Yparam]
                if overlayData_clim:
                    overlayData_clim_extract = extractClim(
                        '0', overlayData_clim
                    )
                else:
                    overlayData_clim_extract = pd.DataFrame()
                # PLOT
                plotScatter(
                    paramData,
                    plotTitle,
                    yLabel,
                    timeRef,
                    paramMin,
                    paramMax,
                    imageName_base,
                    overlayData_clim_extract,
                    overlayData_near,
                    'small',
                )

            del paramData
            gc.collect()
    del siteData
    gc.collect()
    end = datetime.utcnow()
    elapsed = end - now
    print(f"{site} finished: Time elapsed ({str(elapsed)})")
    return (site, elapsed)


def parse_args():
    arg_parser = argparse.ArgumentParser(
        description='QAQC Dashboard Plot Creator'
    )
    arg_parser.add_argument('--time', type=str, default='2020-06-30')
    arg_parser.add_argument(
        '--instrument',
        type=str,
        default='profiler',
        help=f"Choices {str(list(selection_mapping.keys()))}",
    )
    arg_parser.add_argument(
        '--workers',
        type=int,
        default=2,
        help=f"The number of workers",
    )

    arg_parser.add_argument(
        '--dworkers',
        type=int,
        default=2,
        help=f"The number of depths to process at a time",
    )

    return arg_parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    # User options ...
    timeString = args.time
    timeRef = parser.parse(timeString)

    plotInstrument = selection_mapping[args.instrument]

    #  For each param in instrument, append to list of params in checkbox
    paramList = []
    for param in (
        instrument_dict[plotInstrument]['plotParameters']
        .replace('"', '')
        .split(',')
    ):
        paramList.append(param)

    # Timespans
    spans = ['1', '7', '30', '365']
    spanString = {'1': 'day', '7': 'week', '30': 'month', '365': 'year'}

    # Plot Overlays
    overlays = ['clim', 'near', 'time', 'none']

    # Data Ranges
    ranges = ['full', 'local']

    dataList = []
    for key, values in sites_dict.items():
        if plotInstrument in sites_dict[key]['instrument']:
            dataList.append(key)

    now = datetime.utcnow()
    print(f"======= Creation started at: {now.isoformat()} ======")
    creation_times = map_concurrency(
        run_dashboard_creation,
        dataList,
        func_args=(paramList, timeRef, args.dworkers,),
        max_workers=args.workers,
    )
    end = datetime.utcnow()
    print(
        f"======= Creation finished at: {end.isoformat()}. Time elapsed ({end - now}) ======"
    )
