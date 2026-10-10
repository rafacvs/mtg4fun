#!/bin/sh
set -eu

install -d -m 0750 -o mtg4fun -g mtg4fun /var/lib/mtg4fun/images
exec runuser -u mtg4fun -- "$@"
