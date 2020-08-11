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

app.get('/get-mp3/:videoId/:filename?', function (req, res) {
  const videoId = req.params.videoId.includes(':') ? aesutil.decrypt(req.params.videoId) : req.params.videoId;
  console.log(videoId);
  
  const videoUrl = 'https://www.youtube.com/watch?v=' + videoId;

  var videoReadableStream = ytdl(videoUrl, { filter: 'audioonly' });

  ytdl.getInfo(videoUrl, function (err, info) {
    var videoName = info.title.replace('|', '').toString('ascii');

    var file_path = 'mp3s/' + videoName + '.mp3';
    var videoWritableStream = fs.createWriteStream(file_path);

    //  var stream = videoReadableStream.pipe(videoWritableStream);
    //  videoReadableStream.pipe(res);

    var mp3stream = ffmpeg(videoReadableStream)
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .format('mp3')
      .on('error', (err) => console.log(err))
      .on('end', () => {
        var fileReadStream = fs.createReadStream(file_path);
        var fileInfo = fs.statSync(file_path);
        res.setHeader('Content-Length', fileInfo.size);
        res.setHeader('Content-Type', 'audio/mp3');
        res.setHeader('Content-Disposition', 'inline; filename=' + slugify(videoName) + '.mp3');    
        fileReadStream.pipe(res);

        fileReadStream.on('end', () => {
          console.log('File read ended.');
          res.end();

          fs.unlinkSync(file_path);
        });
      })
      .pipe(videoWritableStream, {
        end: true
      });
  });

});

app.get('/get-info/:videoId', function(req, res) {
  const videoId = req.params.videoId.includes(':') ? aesutil.decrypt(req.params.videoId) : req.params.videoId;
  const videoUrl = 'https://www.youtube.com/watch?v=' + videoId;
  const placehold_image = "http://placehold.it/200x200?text=musiclick+p2p+server";

  ytdl.getInfo(videoUrl, function (err, info) {
    const thumbnailsCount = info.videoDetails.thumbnail['thumbnails'].length;
    const videoInfo = {
      thumbnails: {
        "maxres": {
          url: hasTheTimeCome() ? info.videoDetails.thumbnail['thumbnails'][ thumbnailsCount - 1 ].url : placehold_image
        },
        "default": {
          url: hasTheTimeCome() ? info.videoDetails.thumbnail['thumbnails'][ 0 ].url : placehold_image
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
  const placehold_image = "http://placehold.it/200x200?text=musiclick+p2p+server";
  response.items = response.items
                    .filter((_info) => _info.type =='video' && _info.live == false)
                    .map((_info) => {
                      let enc_id = aesutil.encrypt(_info.link.split('v=')[1]);

                      return {
                        id: hasTheTimeCome() ? _info.link.split('v=')[1] : enc_id,
                        title: hasTheTimeCome() ? _info.title : formatName(_info.title),
                        thumbnail: hasTheTimeCome() ? _info.thumbnail : placehold_image,
                        channelTitle: hasTheTimeCome() ? _info.author.name : "musiclick p2p server",
                        duration: _info.duration
                      };
                    });
  res.send(response.items);
});

app.get('/s/search/:queryString', function (req, res) {

});

function hasTheTimeCome() {
  const now = Date.now();
  const target = (new Date('July 01, 2020 00:20:18 GMT+03:00')).getTime();

  return now >= target;
}

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

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

const port = process.env.PORT ? process.env.PORT : 8080;

app.listen(port, function () {
  console.log('http://64.255.102.13:' + port);
});
