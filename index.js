const express = require('express');
const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const fs = require('fs');
const app = express();
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const aesutil = require('./aesutil');

function slugify(text) {
    var trMap = {
        'çÇ':'c',
        'ğĞ':'g',
        'şŞ':'s',
        'üÜ':'u',
        'ıİ':'i',
        'öÖ':'o'
    };
    for(var key in trMap) {
        text = text.replace(new RegExp('['+key+']','g'), trMap[key]);
    }
    return  text.replace(/[^-a-zA-Z0-9\s]+/ig, '') // remove non-alphanumeric chars
                .replace(/\s/gi, "-") // convert spaces to dashes
                .replace(/[-]+/gi, "-") // trim repeated dashes
                .toLowerCase();

}

app.get('/', function (req, res) {
  res.sendFile('/var/www/html/index.html');
});

app.get('/get-mp3/:videoId/:filename?', async function (req, res) {
  const videoId = req.params.videoId.includes(':') ? aesutil.decrypt(req.params.videoId) : req.params.videoId;
  
  const videoUrl = 'https://www.youtube.com/watch?v=' + videoId;

  var videoReadableStream = ytdl(videoUrl, { filter: 'audioonly' });

  const result = await ytdl.getInfo(videoUrl);
  const info = result.videoDetails;
  
  var videoName = info.title.replace('|', '').toString('ascii');

  var file_path = __dirname + '/mp3s/' + videoName + '.mp3';
  fs.closeSync(fs.openSync(file_path, 'w'));

  //  var stream = videoReadableStream.pipe(videoWritableStream);
  //  videoReadableStream.pipe(res);

  ffmpeg(videoReadableStream)
    .audioCodec('libmp3lame')
    .audioBitrate(128)
    .format('mp3')
    .on('error', (err) => console.log(err))
    .on('end', () => {
      res.setHeader('Content-Type', 'audio/mp3');
      res.setHeader('Content-Disposition', 'inline; filename=' + slugify(videoName) + '.mp3');

      res.end();
    })
    .pipe(res, {
      end: true
    });

});

app.get('/get-info/:videoId', function(req, res) {
  const videoId = req.params.videoId.includes(':') ? aesutil.decrypt(req.params.videoId) : req.params.videoId;
  const videoUrl = 'https://www.youtube.com/watch?v=' + videoId;

  ytdl.getInfo(videoUrl, function (err, info) {
    const thumbnailsCount = info.videoDetails.thumbnail['thumbnails'].length;
    const videoInfo = {
      thumbnails: {
        "maxres": {
          url: info.videoDetails.thumbnail['thumbnails'][thumbnailsCount - 1].url
        },
        "default": {
          url: info.videoDetails.thumbnail['thumbnails'][0].url
        }
      },
      channelTitle: info.videoDetails.author.name,
      title: formatName(info.videoDetails.title),
      id: videoId,
    };
    
    res.send({ "items": [{
        "snippet": videoInfo
      }
    ] });
  });
});

app.get('/delete/:videoName', function (req, res) {
  var filename = path.join('/root/ytmp3server/mp3s', `${req.params.videoName}|mp3`);
  filename = filename.replace(/\./g, '').replace('|', '.');

  if (fs.existsSync(filename)) {
    fs.unlinkSync(filename);
  }
  res.end();
});

app.get('/get-search/:queryString', async function (req, res)  {
  let response = await ytsr(req.params.queryString);

  response.items = response.items
    .filter((_info) => _info.type =='video' && _info.live == false)
    .map((_info) => ({
      id: _info.link.split('v=')[1],
      title: _info.title,
      thumbnail: _info.thumbnail,
      channelTitle: _info.author.name,
      duration: _info.duration
    }));
  res.send(response.items);
});

app.get('/s/search/:queryString', function (req, res) {
  // TODO
});

function formatName(str) {
  str = slugify(
    str
      .replace(/ *\([^)]*\) */g, "")
      .replace(/ *\\[[^\]]*\) */g, ""))
        .replace('official', '')
        .replace('music', '')
        .replace('video', '');
  return str;
}

const port = process.env.PORT ? process.env.PORT : 8080;

app.listen(port, function () {
  console.log('http://localhost:' + port);
});
