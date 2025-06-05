import React, { useState, useEffect } from 'react';

const VideoProcessor = () => {
  const [inputFile, setInputFile] = useState('');
  const [outputFile, setOutputFile] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProcessId, setCurrentProcessId] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [operation, setOperation] = useState('compress');
  const [settings, setSettings] = useState({
    quality: 23,
    preset: 'medium',
    format: 'mp4',
    audioFormat: 'mp3'
  });

  useEffect(() => {
    // Set up progress listener
    window.electronAPI.onProgress((progress) => {
      setProgress(Math.round(progress.percent || 0));
    });

    return () => {
      window.electronAPI.removeAllListeners();
    };
  }, []);

  const selectInputFile = async () => {
    const filePath = await window.electronAPI.openFile();
    if (filePath) {
      setInputFile(filePath);
      // Get metadata
      try {
        const meta = await window.electronAPI.getMetadata(filePath);
        setMetadata(meta);
      } catch (error) {
        console.error('Error getting metadata:', error);
      }
    }
  };

  const selectOutputFile = async () => {
    const fileName = inputFile ? `output_${Date.now()}.${operation === 'extract' ? settings.audioFormat : settings.format}` : 'output.mp4';
    const filePath = await window.electronAPI.saveFile(fileName);
    if (filePath) {
      setOutputFile(filePath);
    }
  };

  const processVideo = async () => {
    if (!inputFile || !outputFile) {
      alert('Please select input and output files');
      return;
    }

    setProcessing(true);
    setProgress(0);
    const processId = Date.now().toString();
    setCurrentProcessId(processId);

    try {
      let result;
      switch (operation) {
        case 'compress':
          result = await window.electronAPI.compressVideo({
            inputPath: inputFile,
            outputPath: outputFile,
            options: {
              quality: settings.quality,
              preset: settings.preset,
              processId
            }
          });
          break;
        case 'convert':
          result = await window.electronAPI.convertVideo({
            inputPath: inputFile,
            outputPath: outputFile,
            options: {
              format: settings.format,
              processId
            }
          });
          break;
        case 'extract':
          result = await window.electronAPI.extractAudio({
            inputPath: inputFile,
            outputPath: outputFile,
            options: {
              format: settings.audioFormat,
              processId
            }
          });
          break;
      }
      
      if (result.success) {
        alert('Processing completed successfully!');
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setProcessing(false);
      setProgress(0);
      setCurrentProcessId(null);
    }
  };

  const cancelProcess = async () => {
    if (currentProcessId) {
      await window.electronAPI.cancelProcess(currentProcessId);
      setProcessing(false);
      setProgress(0);
      setCurrentProcessId(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Video Processor</h1>
      
      {/* Operation Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Operation</label>
        <select 
          value={operation} 
          onChange={(e) => setOperation(e.target.value)}
          className="w-full p-2 border rounded-md"
          disabled={processing}
        >
          <option value="compress">Compress Video</option>
          <option value="convert">Convert Format</option>
          <option value="extract">Extract Audio</option>
        </select>
      </div>

      {/* File Selection */}
      <div className="mb-6">
        <div className="mb-4">
          <button
            onClick={selectInputFile}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            disabled={processing}
          >
            Select Input File
          </button>
          {inputFile && (
            <p className="mt-2 text-sm text-gray-600">
              Input: {inputFile}
            </p>
          )}
        </div>

        <div className="mb-4">
          <button
            onClick={selectOutputFile}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            disabled={processing}
          >
            Select Output Location
          </button>
          {outputFile && (
            <p className="mt-2 text-sm text-gray-600">
              Output: {outputFile}
            </p>
          )}
        </div>
      </div>

      {/* Metadata Display */}
      {metadata && (
        <div className="mb-6 p-4 bg-gray-100 rounded">
          <h3 className="font-semibold mb-2">Video Information</h3>
          <p>Duration: {Math.round(metadata.format.duration)} seconds</p>
          <p>Size: {(metadata.format.size / 1024 / 1024).toFixed(2)} MB</p>
          <p>Bitrate: {Math.round(metadata.format.bit_rate / 1000)} kbps</p>
          {metadata.streams[0] && (
            <>
              <p>Resolution: {metadata.streams[0].width}x{metadata.streams[0].height}</p>
              <p>Codec: {metadata.streams[0].codec_name}</p>
            </>
          )}
        </div>
      )}

      {/* Settings */}
      {operation === 'compress' && (
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Compression Settings</h3>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">
              Quality (CRF): {settings.quality}
            </label>
            <input
              type="range"
              min="18"
              max="30"
              value={settings.quality}
              onChange={(e) => setSettings({...settings, quality: parseInt(e.target.value)})}
              className="w-full"
              disabled={processing}
            />
            <p className="text-xs text-gray-500">Lower values = better quality, larger file</p>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Preset</label>
            <select
              value={settings.preset}
              onChange={(e) => setSettings({...settings, preset: e.target.value})}
              className="w-full p-2 border rounded"
              disabled={processing}
            >
              <option value="ultrafast">Ultra Fast</option>
              <option value="faster">Faster</option>
              <option value="fast">Fast</option>
              <option value="medium">Medium</option>
              <option value="slow">Slow</option>
              <option value="slower">Slower</option>
            </select>
          </div>
        </div>
      )}

      {operation === 'convert' && (
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Conversion Settings</h3>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Output Format</label>
            <select
              value={settings.format}
              onChange={(e) => setSettings({...settings, format: e.target.value})}
              className="w-full p-2 border rounded"
              disabled={processing}
            >
              <option value="mp4">MP4</option>
              <option value="avi">AVI</option>
              <option value="mov">MOV</option>
              <option value="mkv">MKV</option>
              <option value="webm">WebM</option>
            </select>
          </div>
        </div>
      )}

      {operation === 'extract' && (
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Audio Extraction Settings</h3>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Audio Format</label>
            <select
              value={settings.audioFormat}
              onChange={(e) => setSettings({...settings, audioFormat: e.target.value})}
              className="w-full p-2 border rounded"
              disabled={processing}
            >
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
              <option value="aac">AAC</option>
              <option value="m4a">M4A</option>
            </select>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {processing && (
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm">{progress}% Complete</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={processVideo}
          className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700"
          disabled={processing || !inputFile || !outputFile}
        >
          {processing ? 'Processing...' : 'Start Processing'}
        </button>
        
        {processing && (
          <button
            onClick={cancelProcess}
            className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoProcessor;