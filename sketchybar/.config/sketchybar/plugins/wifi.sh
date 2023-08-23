#!/usr/bin/env bash

UPDOWN=$(ifstat -i "en0" -b 0.1 1 | tail -n1)
DOWN=$(echo "$UPDOWN" | awk "{ print \$1 }" | cut -f1 -d ".")
UP=$(echo "$UPDOWN" | awk "{ print \$2 }" | cut -f1 -d ".")

DOWN_FORMAT=""
if [ "$DOWN" -gt "9999" ]; then
	DOWN_FORMAT=$(echo "$DOWN" | awk '{ printf "%04.0f Mbps", $1 / 1000}')
else
	DOWN_FORMAT=$(echo "$DOWN" | awk '{ printf "%04.0f kbps", $1}')
fi

UP_FORMAT=""
if [ "$UP" -gt "9999" ]; then
	UP_FORMAT=$(echo "$UP" | awk '{ printf "%04.0f Mbps", $1 / 1000}')
else
	UP_FORMAT=$(echo "$UP" | awk '{ printf "%04.0f kbps", $1}')
fi

sketchybar -m --set network.down label="$DOWN_FORMAT" \
	--set network.up label="$UP_FORMAT" 

