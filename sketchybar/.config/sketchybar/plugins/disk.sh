#!/usr/bin/env bash

sketchybar -m --set "$NAME" label="$(df -H /System/Volumes/Data | awk 'END {print $3}' | sed 's/%//')" icon=
