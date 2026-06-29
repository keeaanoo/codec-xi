// Video Compression using FFmpeg.wasm

document.addEventListener('DOMContentLoaded', () => {
  const videoInputFile = document.getElementById('video-input-file');
  const videoResolution = document.getElementById('video-resolution');
  const videoPreset = document.getElementById('video-preset');
  const btnVideoCompress = document.getElementById('btn-video-compress');
  const btnVideoDownload = document.getElementById('btn-video-download');
  
  const videoStatsContainer = document.getElementById('video-stats-container');
  const videoOrigSize = document.getElementById('video-orig-size');
  const videoCompSize = document.getElementById('video-comp-size');
  const videoRatio = document.getElementById('video-ratio');
  const videoLogs = document.getElementById('video-logs');

  let selectedVideoFile = null;
  let compressedVideoUrl = null;

  videoInputFile.addEventListener('change', (e) => {
    selectedVideoFile = e.target.files[0];
    if (!selectedVideoFile) return;

    videoOrigSize.textContent = formatBytes(selectedVideoFile.size);
    videoStatsContainer.classList.remove('hidden');

    if (ffmpegLoaded) {
      btnVideoCompress.removeAttribute('disabled');
      btnVideoCompress.classList.remove('bg-[#2a2a2a]', 'text-[#888888]');
      btnVideoCompress.classList.add('bg-white', 'text-black');
    } else {
      videoLogs.textContent += "Please wait for FFmpeg.wasm to finish loading.\n";
    }
  });

  btnVideoCompress.addEventListener('click', async () => {
    if (!selectedVideoFile || !ffmpegInstance) return;

    btnVideoCompress.disabled = true;
    btnVideoCompress.textContent = "COMPRESSING (0%)";
    btnVideoDownload.classList.add('hidden');
    videoLogs.textContent = "Loading file into virtual file system...\n";

    try {
      const { fetchFile } = FFmpegUtil;

      // 1. Read input file
      const fileData = await fetchFile(selectedVideoFile);
      const inputName = `input_${selectedVideoFile.name}`;
      
      // Write to FFmpeg WASM FS
      await ffmpegInstance.writeFile(inputName, fileData);
      
      const resSetting = videoResolution.value;
      const presetSetting = videoPreset.value;
      const outputName = "output_compressed.mp4";

      videoLogs.textContent += `Starting transcoding process... Resolution: ${resSetting}, Preset: ${presetSetting}\n`;

      // Build FFmpeg arguments
      const args = ['-i', inputName];

      // Add scaling filter if requested
      if (resSetting === '480') {
        args.push('-vf', 'scale=-2:480');
      } else if (resSetting === '720') {
        args.push('-vf', 'scale=-2:720');
      }

      // Add video codec options
      // CRF 28 is standard for high compression ratio with decent quality
      // We use libx264 which is standard in ffmpeg.wasm
      args.push(
        '-c:v', 'libx264',
        '-crf', '28',
        '-preset', presetSetting,
        '-c:a', 'aac',
        '-b:a', '128k',
        outputName
      );

      // Execute command
      await ffmpegInstance.exec(args);

      // Read output
      const outputData = await ffmpegInstance.readFile(outputName);
      
      // Create output blob
      const outputBlob = new Blob([outputData.buffer], { type: 'video/mp4' });
      
      // Stats
      videoCompSize.textContent = formatBytes(outputBlob.size);
      const ratio = ((1 - (outputBlob.size / selectedVideoFile.size)) * 100).toFixed(2) + "%";
      videoRatio.textContent = ratio;

      if (compressedVideoUrl) URL.revokeObjectURL(compressedVideoUrl);
      compressedVideoUrl = URL.createObjectURL(outputBlob);

      btnVideoDownload.href = compressedVideoUrl;
      btnVideoDownload.download = "compressed_video.mp4";
      btnVideoDownload.classList.remove('hidden');

      btnVideoCompress.textContent = "COMPRESSION DONE";
      videoLogs.textContent += "Compression finished successfully!\n";

      // Cleanup files from FFmpeg memory
      await ffmpegInstance.deleteFile(inputName);
      await ffmpegInstance.deleteFile(outputName);

    } catch (err) {
      console.error(err);
      videoLogs.textContent += `Error: ${err.message}\n`;
      btnVideoCompress.textContent = "COMPRESS FAILED";
    } finally {
      // Re-enable button if file still selected
      btnVideoCompress.removeAttribute('disabled');
    }
  });
});
