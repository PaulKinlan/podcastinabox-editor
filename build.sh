#! /bin/bash

yum install -y wget

git submodule update --init --recursive -j 8

npm install

cp -r node_modules/@editorjs/editorjs/dist record/javascripts/editorjs/
cp -r node_modules/@editorjs/raw/dist/bundle.js record/javascripts/editorjs/raw.js
cp -r node_modules/@editorjs/quote/dist/bundle.js record/javascripts/editorjs/quote.js
cp -r node_modules/@editorjs/header/dist/bundle.js record/javascripts/editorjs/header.js
cp -r node_modules/@editorjs/paragraph/dist/bundle.js record/javascripts/editorjs/paragraph.js
cp -r node_modules/@editorjs/code/dist/bundle.js record/javascripts/editorjs/code.js
cp -r node_modules/@editorjs/list/dist/bundle.js record/javascripts/editorjs/list.js
cp -r node_modules/@editorjs/link/dist/bundle.js record/javascripts/editorjs/link.js
cp -r node_modules/@editorjs/simple-image/dist/bundle.js record/javascripts/editorjs/simple-image.js

mkdir dist
cp record/* -R dist