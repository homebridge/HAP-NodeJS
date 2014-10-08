#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
BASEDIR=$(dirname $SCRIPT_DIR)
export PATH=$PATH:$SCRIPT_DIR/../node_modules/.bin

VOWS=`which vows 2> /dev/null`
if [ ! -x "$VOWS" ]; then
    echo "vows not found in your path.  try:  npm install"
    exit 1
fi

# vows hates absolute paths.  sheesh.
cd $BASEDIR

vows

# don't trigger npm doing funny stuff
exit 0