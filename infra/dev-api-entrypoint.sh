#!/bin/sh
set -eu

./bin/mtg4fun migrate up
exec ./bin/mtg4fun serve
