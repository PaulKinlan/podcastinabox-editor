const url = new URL(location);
const description = url.searchParams.get('text');
let data = {};
let editor;
let config = {
  apiKey: "AIzaSyDCxJm4JBrX2sqRBENPdbeCMYXMXZb1SYc",
  authDomain: "podcastinabox-77f89.firebaseapp.com",
  projectId: "podcastinabox-77f89"
};

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
    localStorage.setItem('user', result.user);
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

const createFile = async (filename, data, images, commitMessage, recording) => {
  try {
    const token = localStorage.getItem('accessToken');
    const github = new Octokat({ 'token': token });
    const markdownPath = `site/content/en/${filename}.markdown`.toLowerCase();
  
    let repo = await github.repos('paulkinlan', 'paul.kinlan.me').fetch();
    let main = await repo.git.refs('heads/main').fetch();
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
      let audioPath = `site/static/audio/${recording.name}`.toLowerCase();
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
  };
  recorder.start();
};

const updateRecording = (blob) => {
  const reader = new FileReader();
  reader.readAsDataURL(blob)
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
  
  if (localStorage.getItem('accessToken') !== null) {
    authenticate.style.display = 'none';
  }

  authenticate.onclick = async () => {
    await auth();
  };

  startRecord.addEventListener('click', () => {
    record();
  });

  stopRecord.addEventListener('click', () => {
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
    recording.name = `${fileName}.webm`;
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
mp3: /audio/${recording.name}.mp3
ogg: /audio/${recording.name}.ogg
---
${main.join('\n')}
`;
    createFile(fileName, body, images, cleanName, recording);
  };
  populateFields();
}