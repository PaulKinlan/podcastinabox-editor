import WaveSurfer from 'wavesurfer.js';
import EditorJS from '@editorjs/editorjs';
import List from '@editorjs/list';
import Header from '@editorjs/header';
import Paragraph from '@editorjs/paragraph';
import CodeTool from '@editorjs/code';
import SimpleImage from '@editorjs/simple-image';
import Quote from '@editorjs/quote';
import Octokat from 'octokat';

let data = {};
let config = {
  apiKey: "AIzaSyDCxJm4JBrX2sqRBENPdbeCMYXMXZb1SYc",
  authDomain: "podcastinabox-77f89.firebaseapp.com",
  projectId: "podcastinabox-77f89"
};

let editor;
let wavesurfer;

const initEditor = (imageBlob) => {
  const editorElement = document.getElementById('editor');
  editorElement.innerHTML = '';

  if (imageBlob) {
    data = {
      blocks: [{
        type: 'image',
        data: {
          url: URL.createObjectURL(imageBlob)
        }
      }]
    }
  }

  editor = new EditorJS({
    holderId: 'editor',
    tools: {
      list: {
        class: List,
        inlineToolbar: true,
      },
      image: SimpleImage,
      header: Header,
      paragraph: {
        class: Paragraph,
        inlineToolbar: true,
      },
      code: {
        class:  CodeTool,
        shortcut: 'CMD+SHIFT+C'
      },
      quote: {
        class: Quote,
        inlineToolbar: true,
        shortcut: 'CMD+SHIFT+O',
        config: {
          quotePlaceholder: 'Enter a quote',
          captionPlaceholder: 'Quote\'s author',
        },
      }
    },
    data: data
  });
};

initEditor();

const auth = async () => {
  firebase.initializeApp(config);
  var provider = new firebase.auth.GithubAuthProvider();
  provider.addScope('repo');

  try {
    const result = await firebase.auth().signInWithPopup(provider);

    // This gives you a GitHub Access Token. You can use it to access the GitHub API.
    var token = result.credential.accessToken;
    localStorage.setItem('accessToken', token);
    localStorage.setItem('user', JSON.stringify(result.user.toJSON()));
    logToToast(`Welcome ${result.user}`);
    return result;
  } catch (error) {
    // Handle Errors here.
    console.log(error)
    var errorCode = error.code;
    var errorMessage = error.message;
    // The email of the user's account used.
    var email = error.email;
    // The firebase.auth.AuthCredential type that was used.
    var credential = error.credential;
    // ...
    logToToast(`Unable to login: ${errorMessage}`)
  }
};

const createCommit = async (repositoryUrl, filename, data, images, commitMessage, recording) => {
  try {
    const token = localStorage.getItem('accessToken');
    const github = new Octokat({ 'token': token });
    const [user, repoName] = repositoryUrl.split('/');

    if(user === null || repoName === null) {
      alert('Please specifiy a repo');
      return;
    }
    
    const markdownPath = `site/content/${filename}.markdown`.toLowerCase();
    let repo = await github.repos(user, repoName).fetch();
    let main = await repo.git.refs('heads/master').fetch();
    let treeItems = [];

    for(let image of images) {
      let imageGit = await repo.git.blobs.create({ content: image.data, encoding: 'base64' });
      let imagePath = `site/static/images/${image.name}`.toLowerCase();
      treeItems.push({
        path: imagePath,
        sha: imageGit.sha,
        mode: "100644",
        type: "blob"
        });
    }

    if (recording) {
      let audioGit = await repo.git.blobs.create({ content: recording.data, encoding: 'base64' });
      let audioPath = `site/static/audio/${recording.name}.${recording.extension}`.toLowerCase();
      treeItems.push({
        path: audioPath,
        sha: audioGit.sha,
        mode: "100644",
        type: "blob"
        });
    }

    let markdownFile = await repo.git.blobs.create({ content: btoa(jsonEncode(data)), encoding: 'base64' });
    treeItems.push({
      path: markdownPath,
      sha: markdownFile.sha,
      mode: "100644",
      type: "blob"
    });

    let tree = await repo.git.trees.create({
      tree: treeItems,
      base_tree: main.object.sha
    });
  
    let commit = await repo.git.commits.create({
      message: `Created via Web - ${commitMessage}`,
      tree: tree.sha,
      parents: [main.object.sha]});

    main.update({sha: commit.sha})

    logToToast('Posted');
  } catch (err) {
    console.error(err);
    logToToast(err);
  }
};

const populateFields = () => {
  const url = new URL(location);

  console.log('populate fields', url);
}

const htmlEncode = (str) => {
  str = str.replace(/[^\x00-\x7F]/g, function (char) {
    var hex = char.charCodeAt(0).toString(16);
    while (hex.length < 4) hex = '0' + hex;

    return '&#x' + hex + ';';
  });

  return str;
};

const jsonEncode = (str) => {
  str = str.replace(/[^\x00-\x7F]/g, function (char) {
    var hex = char.charCodeAt(0).toString(16);
    while (hex.length < 4) hex = '0' + hex;

    return '\\u' + hex;
  });

  return str;
};

const logToToast = (str) => {
  const output = document.getElementById('output');
  output.textContent += str + '\n';
};

let recorder;
let recording = {};

const record = async () => {
  const opts = {mimeType: 'audio/webm; codecs=opus'};
  const blobs = [];
  const stream = await navigator.mediaDevices.getUserMedia({audio: true});
  recorder = new MediaRecorder(stream, opts);
  recorder.ondataavailable = (e) => blobs.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(blobs, {type: 'audio/webm'});
    updateRecording(blob);
    stream.getAudioTracks().forEach(track=>track.stop());
  };
  recorder.start();
};

const updateRecording = (blob) => {
  if (wavesurfer === undefined) {
    wavesurfer = WaveSurfer.create({
      container: '#waveform',
      waveColor: 'black',
      interact: false,
    });
  }

  const reader = new FileReader();
  reader.readAsDataURL(blob);
  wavesurfer.loadBlob(blob);
  reader.addEventListener('load', () => {
    const url = URL.createObjectURL(blob);
    const podcastPlayback = document.getElementById("podcastPlayback");
    podcastPlayback.src = url;
    recording.blob = blob;
    recording.data = reader.result;
  });
};

onload = async () => {
  const noteForm = document.getElementById('noteform');
  const startRecord = document.getElementById('startRecord');
  const stopRecord = document.getElementById('stopRecord');
  const podcastRecordingFile = document.getElementById('podcastrecording');
  const authenticate = document.getElementById('authenticate');
  const reposEl = document.getElementById('repos');
  const accessToken = localStorage.getItem('accessToken');
  let github;
  if (accessToken !== null) {
    authenticate.style.display = 'none';
    github = new Octokat({ 'token': accessToken });
    github.user.repos.fetchAll().then(repos => {
      const repoFragment = document.createDocumentFragment();
      repos.forEach(repo => {
        const option = document.createElement('option');
        option.value = repo.fullName;
        repoFragment.appendChild(option);
      });
      reposEl.appendChild(repoFragment);
    });
  }

  authenticate.onclick = async () => {
    await auth();
  };

  startRecord.addEventListener('click', () => {
    startRecord.disabled = true;
    stopRecord.disabled = false;
    record();
  });

  stopRecord.addEventListener('click', () => {
    startRecord.disabled = false;
    stopRecord.disabled = true;
    if (recorder) {
      recorder.stop();
    }
  });

  podcastRecordingFile.addEventListener('change', () => {
    const file = podcastRecordingFile.files[0];
    updateRecording(file);
  });

  noteForm.onsubmit = async (event) => {
    event.preventDefault();

    const repoEl = document.getElementById('repo');
    const repo = repoEl.value;

    if (recording === undefined) {
      alert('You need to record a file, or provide one');
      return;
    }

    const editorData = await editor.save();

    if (localStorage.getItem('accessToken') === null) {
      alert('Please Auth');
      logToToast('Please Authenticate')
    }

    const name = document.getElementById('name').value;
    const cleanName = name.replace(/[^a-zA-Z0-9\-_]/g, '-').replace(/-{2,}/g,'');
    const dateParts = new Date().toISOString().split('T');
    const fileName = `${dateParts[0]}-${cleanName}`;
    let images = [];
    // At some point we will have multiple files.
    recording.name = `${fileName}`;
    recording.extension = 'webm'
    recording.data = recording.data.replace(/([^,]+),/, "");
      
    const main = editorData.blocks.map((cur) => {
      if (cur.type === 'paragraph') return htmlEncode(cur.data.text) + '\n';
      if (cur.type === 'quote') return `> ${htmlEncode(cur.data.text).split('\n').join('\n> ')}\n\n${cur.data.caption}\n`;
      if (cur.type === 'list') return cur.data.items.join(`\n${ (cur.data.style === 'ordered') ? '1. ' : '* '}`) + `\n\n${cur.data.caption}\n`;
      if (cur.type === 'code') return `\`\`\`\n${cur.data.code}\n\`\`\`\n`;
      if (cur.type === 'image') {
        let currImageID = images.length;
        let name = `${fileName.toLowerCase()}-${currImageID}.jpeg`;
        images.push({name: name, data: cur.data.url.replace(/([^,]+),/, "")});
        return `<figure><img src="/images/${fileName.toLowerCase()}-${currImageID}.jpeg"></figure>\n`;
      }
    }, '');
    const body = `---
slug: ${cleanName.toLowerCase()}
date: ${dateParts.join('T')}
title: '${name}'
mp3: /audio/${recording.name.toLowerCase()}.mp3
webm: /audio/${recording.name.toLowerCase()}.webm
---

${main.join('\n')}
`;
    createCommit(repo, fileName, body, images, cleanName, recording);
  };
  populateFields();
}