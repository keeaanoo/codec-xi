// Audio Compression using FFmpeg.wasm

document.addEventListener('DOMContentLoaded', () => {
  const audioInputFile = document.getElementById('audio-input-file');
  const audioBitrate = document.getElementById('audio-bitrate');
  const btnAudioCompress = document.getElementById('btn-audio-compress');
  const btnAudioDownload = document.getElementById('btn-audio-download');
  
  const audioStatsContainer = document.getElementById('audio-stats-container');
  const audioOrigSize = document.getElementById('audio-orig-size');
  const audioCompSize = document.getElementById('audio-comp-size');
  const audioRatio = document.getElementById('audio-ratio');
  const audioLogs = document.getElementById('audio-logs');

  let selectedAudioFile = null;
  let compressedAudioUrl = null;

  audioInputFile.addEventListener('change', (e) => {
    selectedAudioFile = e.target.files[0];
    if (!selectedAudioFile) return;

    audioOrigSize.textContent = formatBytes(selectedAudioFile.size);
    audioStatsContainer.classList.remove('hidden');

    if (ffmpegLoaded) {
      btnAudioCompress.removeAttribute('disabled');
      btnAudioCompress.classList.remove('bg-[#2a2a2a]', 'text-[#888888]');
      btnAudioCompress.classList.add('bg-white', 'text-black');
    } else {
      audioLogs.textContent += "Please wait for FFmpeg.wasm to finish loading.\n";
    }
  });

  btnAudioCompress.addEventListener('click', async () => {
    if (!selectedAudioFile || !ffmpegInstance) return;

    btnAudioCompress.disabled = true;
    btnAudioCompress.textContent = "COMPRESSING (0%)";
    btnAudioDownload.classList.add('hidden');
    audioLogs.textContent = "Loading file into virtual file system...\n";

    try {
      const { fetchFile } = FFmpegUtil;

      // 1. Read input file
      const fileData = await fetchFile(selectedAudioFile);
      const inputName = `input_${selectedAudioFile.name}`;
      
      // Write to FFmpeg WASM FS
      await ffmpegInstance.writeFile(inputName, fileData);
      
      // Determine settings
      const formatSetting = audioBitrate.value;
      let outputName = "output.aac";
      let args = [];

      audioLogs.textContent += `Starting transcoding process... Option selected: ${formatSetting}\n`;

      if (formatSetting === '64k') {
        outputName = "output_64k.aac";
        args = ['-i', inputName, '-c:a', 'aac', '-b:a', '64k', outputName];
      } else if (formatSetting === '96k') {
        outputName = "output_96k.aac";
        args = ['-i', inputName, '-c:a', 'aac', '-b:a', '96k', outputName];
      } else if (formatSetting === '128k') {
        outputName = "output_128k.aac";
        args = ['-i', inputName, '-c:a', 'aac', '-b:a', '128k', outputName];
      } else if (formatSetting === 'mp3-96k') {
        outputName = "output_96k.mp3";
        args = ['-i', inputName, '-b:a', '96k', outputName];
      } else if (formatSetting === 'mp3-128k') {
        outputName = "output_128k.mp3";
        args = ['-i', inputName, '-b:a', '128k', outputName];
      }

      // Execute command
      await ffmpegInstance.exec(args);

      // Read output
      const outputData = await ffmpegInstance.readFile(outputName);
      
      // Create output blob
      const mimeType = outputName.endsWith('.mp3') ? 'audio/mp3' : 'audio/aac';
      const outputBlob = new Blob([outputData.buffer], { type: mimeType });
      
      // Stats
      audioCompSize.textContent = formatBytes(outputBlob.size);
      const ratio = ((1 - (outputBlob.size / selectedAudioFile.size)) * 100).toFixed(2) + "%";
      audioRatio.textContent = ratio;

      if (compressedAudioUrl) URL.revokeObjectURL(compressedAudioUrl);
      compressedAudioUrl = URL.createObjectURL(outputBlob);

      btnAudioDownload.href = compressedAudioUrl;
      btnAudioDownload.download = outputName;
      btnAudioDownload.classList.remove('hidden');

      btnAudioCompress.textContent = "COMPRESSION DONE";
      audioLogs.textContent += "Compression finished successfully!\n";

      // Cleanup files from FFmpeg memory
      await ffmpegInstance.deleteFile(inputName);
      await ffmpegInstance.deleteFile(outputName);

    } catch (err) {
      console.error(err);
      audioLogs.textContent += `Error: ${err.message}\n`;
      btnAudioCompress.textContent = "COMPRESS FAILED";
    } finally {
      // Re-enable button if file still selected
      btnAudioCompress.removeAttribute('disabled');
    }
  });
});
