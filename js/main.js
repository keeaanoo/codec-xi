// Global FFmpeg reference
let ffmpegInstance = null;
let ffmpegLoaded = false;

// Tab switcher logic
function switchTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
  });
  
  // Show target tab content
  const targetContent = document.getElementById(`content-${tabName}`);
  if (targetContent) {
    targetContent.classList.remove('hidden');
    // If it's a grid, restore grid behavior
    if (tabName === 'image' || tabName === 'stego') {
      targetContent.classList.add('grid');
    }
  }

  // Deactivate all tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('border-white', 'bg-white', 'text-black', 'font-bold');
    btn.classList.add('border-[#2a2a2a]', 'text-[#888888]');
  });

  // Activate selected tab button
  const activeBtn = document.getElementById(`tab-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove('border-[#2a2a2a]', 'text-[#888888]');
    activeBtn.classList.add('border-white', 'bg-white', 'text-black', 'font-bold');
  }
}

// Utility to format bytes to human readable string
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Initialize FFmpeg
async function initFFmpeg() {
  const loaderEl = document.getElementById('ffmpeg-loader');
  const statusEl = document.getElementById('ffmpeg-status');
  
  try {
    const { FFmpeg } = FFmpegWASM;
    const { toBlobURL } = FFmpegUtil;
    
    ffmpegInstance = new FFmpeg();
    
    // Track loading progress
    ffmpegInstance.on('log', ({ message }) => {
      // Direct logs to page logs if running audio/video
      const audioLogs = document.getElementById('audio-logs');
      const videoLogs = document.getElementById('video-logs');
      if (audioLogs && !document.getElementById('content-audio').classList.contains('hidden')) {
        audioLogs.textContent += message + '\n';
        audioLogs.scrollTop = audioLogs.scrollHeight;
      }
      if (videoLogs && !document.getElementById('content-video').classList.contains('hidden')) {
        videoLogs.textContent += message + '\n';
        videoLogs.scrollTop = videoLogs.scrollHeight;
      }
      console.log('[FFmpeg Log]', message);
    });

    ffmpegInstance.on('progress', ({ progress }) => {
      const percentage = Math.round(progress * 100);
      console.log(`[FFmpeg Progress] ${percentage}%`);
      
      // Update running task compression progress if any
      const activeCompressBtn = document.querySelector('.tab-content:not(.hidden) button[id*="compress"]');
      if (activeCompressBtn && activeCompressBtn.disabled) {
        activeCompressBtn.textContent = `COMPRESSING (${percentage}%)`;
      }
    });

    const coreVersion = '0.12.6';
    const baseURL = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/umd`;
    
    statusEl.textContent = 'LOADING CORE...';
    
    await ffmpegInstance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegLoaded = true;
    loaderEl.classList.add('bg-neutral-900', 'text-neutral-500');
    loaderEl.classList.remove('bg-white', 'text-black');
    loaderEl.querySelector('span').textContent = 'FFMPEG.WASM: READY';
    statusEl.textContent = 'OK';
    
    // Enable audio and video compression buttons
    const audioBtn = document.getElementById('btn-audio-compress');
    const videoBtn = document.getElementById('btn-video-compress');
    if (audioBtn && document.getElementById('audio-input-file').files.length > 0) audioBtn.removeAttribute('disabled');
    if (videoBtn && document.getElementById('video-input-file').files.length > 0) videoBtn.removeAttribute('disabled');
    
  } catch (err) {
    console.error('Failed to load FFmpeg.wasm:', err);
    loaderEl.classList.add('bg-red-900', 'text-red-100');
    loaderEl.classList.remove('bg-white', 'text-black');
    loaderEl.querySelector('span').textContent = 'FFMPEG.WASM: LOAD ERROR';
    statusEl.textContent = 'FAILED';
  }
}

// Load FFmpeg on page load
window.addEventListener('DOMContentLoaded', () => {
  initFFmpeg();
});
