#!/bin/bash

__REAL_SCRIPTDIR=$( cd -P -- "$(dirname -- "$(command -v -- "$0")")" && pwd -P )
__REAL_PROJECTDIR=$(dirname ${__REAL_SCRIPTDIR})

echo "Running scripts"
cd ${__REAL_PROJECTDIR}
npm run run_ts_LTC
