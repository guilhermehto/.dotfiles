#!/usr/bin/env sh

CPU_USAGE=$(top -l 1 -n 0 | awk '/CPU usage/ {sum = $3 + $5} END {print sum}')
CPU_USAGE_INT=${CPU_USAGE%.*}

sketchybar --set $NAME label="$CPU_USAGE_INT%" icon=󰇅

