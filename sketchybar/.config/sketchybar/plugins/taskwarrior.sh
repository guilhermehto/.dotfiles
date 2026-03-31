#!/usr/bin/env bash

MAX_LENGTH=40

ACTIVE_JSON=$(task +ACTIVE export rc.verbose=nothing rc.json.array=on 2>/dev/null)
TASK_COUNT=$(echo "$ACTIVE_JSON" | jq 'length' 2>/dev/null)

if [ "$TASK_COUNT" -gt 0 ] 2>/dev/null; then
  DESC=$(echo "$ACTIVE_JSON" | jq -r '.[0].description' 2>/dev/null)
  PROJECT=$(echo "$ACTIVE_JSON" | jq -r '.[0].project // empty' 2>/dev/null)

  if [ -n "$PROJECT" ]; then
    LABEL="[$PROJECT] $DESC"
  else
    LABEL="$DESC"
  fi

  if [ ${#LABEL} -gt $MAX_LENGTH ]; then
    LABEL="${LABEL:0:$((MAX_LENGTH-3))}..."
  fi

  if [ "$TASK_COUNT" -gt 1 ]; then
    LABEL="$LABEL (+$((TASK_COUNT-1)))"
  fi

  ICON="󰄬"
  ICON_COLOR="0xffb8bb26"
else
  LABEL=""
  ICON="󰄱"
  ICON_COLOR="0xff928374"
fi

sketchybar --set $NAME label="$LABEL" icon="$ICON" icon.color="$ICON_COLOR"
