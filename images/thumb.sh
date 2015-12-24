#!/bin/sh
convert $1 -resize 525 $(basename $1 .jpg).thumb.jpg
convert $1 -resize $((2*525)) $(basename $1 .jpg).thumb.2x.jpg
