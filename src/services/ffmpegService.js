const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const path = require('path');
const { app } = require('electron');

// Set FFmpeg paths
if (app.isPackaged) {
  // In production, use the bundled binaries
  const resourcesPath = process.resourcesPath;
  const platform = process.platform;
  const arch = process.arch;
  
  ffmpeg.setFfmpegPath(path.join(resourcesPath, `@ffmpeg-installer/${platform}-${arch}/ffmpeg${platform === 'win32' ? '.exe' : ''}`));
  ffmpeg.setFfprobePath(path.join(resourcesPath, `@ffprobe-installer/${platform}-${arch}/ffprobe${platform === 'win32' ? '.exe' : ''}`));
} else {
  // In development, use the npm installed binaries
  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg.setFfprobePath(ffprobePath);
}

class FFmpegService {
  constructor() {
    this.activeProcesses = new Map();
  }

  // Get video metadata
  async getMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });
  }

  // Compress video
  compressVideo(inputPath, outputPath, options = {}) {
    const {
      quality = 23, // CRF value (0-51, lower is better quality)
      preset = 'medium', // Encoding speed preset
      resolution = null, // e.g., '1280x720'
      onProgress = () => {},
      processId = Date.now().toString()
    } = options;

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .outputOptions([
          `-crf ${quality}`,
          `-preset ${preset}`,
          '-c:v libx264',
          '-c:a aac',
          '-movflags +faststart'
        ]);

      if (resolution) {
        command.size(resolution);
      }

      command
        .on('start', (commandLine) => {
          console.log('Spawned FFmpeg with command: ' + commandLine);
        })
        .on('progress', (progress) => {
          onProgress({
            percent: progress.percent || 0,
            timemark: progress.timemark,
            targetSize: progress.targetSize,
            processId
          });
        })
        .on('end', () => {
          this.activeProcesses.delete(processId);
          resolve({ success: true, outputPath });
        })
        .on('error', (err) => {
          this.activeProcesses.delete(processId);
          reject(err);
        })
        .save(outputPath);

      this.activeProcesses.set(processId, command);
    });
  }

  // Convert video format
  convertVideo(inputPath, outputPath, options = {}) {
    const {
      format = 'mp4',
      codec = 'libx264',
      audioCodec = 'aac',
      onProgress = () => {},
      processId = Date.now().toString()
    } = options;

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .toFormat(format)
        .videoCodec(codec)
        .audioCodec(audioCodec);

      command
        .on('progress', (progress) => {
          onProgress({
            percent: progress.percent || 0,
            timemark: progress.timemark,
            processId
          });
        })
        .on('end', () => {
          this.activeProcesses.delete(processId);
          resolve({ success: true, outputPath });
        })
        .on('error', (err) => {
          this.activeProcesses.delete(processId);
          reject(err);
        })
        .save(outputPath);

      this.activeProcesses.set(processId, command);
    });
  }

  // Extract audio from video
  extractAudio(inputPath, outputPath, options = {}) {
    const {
      format = 'mp3',
      bitrate = '192k',
      onProgress = () => {},
      processId = Date.now().toString()
    } = options;

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate(bitrate)
        .toFormat(format);

      command
        .on('progress', (progress) => {
          onProgress({
            percent: progress.percent || 0,
            timemark: progress.timemark,
            processId
          });
        })
        .on('end', () => {
          this.activeProcesses.delete(processId);
          resolve({ success: true, outputPath });
        })
        .on('error', (err) => {
          this.activeProcesses.delete(processId);
          reject(err);
        })
        .save(outputPath);

      this.activeProcesses.set(processId, command);
    });
  }

  // Cancel a process
  cancelProcess(processId) {
    const command = this.activeProcesses.get(processId);
    if (command) {
      command.kill('SIGKILL');
      this.activeProcesses.delete(processId);
      return true;
    }
    return false;
  }

  // Get all supported formats
  getFormats() {
    return new Promise((resolve, reject) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) reject(err);
        else resolve(formats);
      });
    });
  }

  // Get all supported codecs
  getCodecs() {
    return new Promise((resolve, reject) => {
      ffmpeg.getAvailableCodecs((err, codecs) => {
        if (err) reject(err);
        else resolve(codecs);
      });
    });
  }
}

module.exports = new FFmpegService();