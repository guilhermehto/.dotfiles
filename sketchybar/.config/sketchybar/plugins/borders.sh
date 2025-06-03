#!/usr/bin/env sh

# Keeps borders process alive

border_pid=$(pgrep borders)

if [ -z "$border_pid" ]; then
  borders &
fi

