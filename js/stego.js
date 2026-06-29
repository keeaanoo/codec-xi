// LSB Steganography Encode & Decode Logic

document.addEventListener('DOMContentLoaded', () => {
  // Encode controls
  const stegoEncodeImg = document.getElementById('stego-encode-img');
  const stegoMessage = document.getElementById('stego-message');
  const btnStegoEncode = document.getElementById('btn-stego-encode');
  const btnStegoDownload = document.getElementById('btn-stego-download');
  const stegoCapacityInfo = document.getElementById('stego-capacity-info');
  const stegoCapacityUsed = document.getElementById('stego-capacity-used');
  const stegoCapacityTotal = document.getElementById('stego-capacity-total');

  // Decode controls
  const stegoDecodeImg = document.getElementById('stego-decode-img');
  const btnStegoDecode = document.getElementById('btn-stego-decode');
  const stegoDecodedOutput = document.getElementById('stego-decoded-output');

  let encodeCanvas = null;
  let encodeCtx = null;
  let originalEncodeData = null;

  let decodeCanvas = null;
  let decodeCtx = null;
  let originalDecodeData = null;

  let stegoImageBlobUrl = null;

  // Handle Cover Image Upload
  stegoEncodeImg.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      // Set preview image
      const previewImg = document.getElementById('stego-encode-preview');
      const previewContainer = document.getElementById('stego-encode-preview-container');
      if (previewImg && previewContainer) {
        previewImg.src = event.target.result;
        previewContainer.classList.remove('hidden');
      }

      const img = new Image();
      img.onload = function() {
        encodeCanvas = document.createElement('canvas');
        encodeCanvas.width = img.width;
        encodeCanvas.height = img.height;
        encodeCtx = encodeCanvas.getContext('2d');
        encodeCtx.drawImage(img, 0, 0);
        
        originalEncodeData = encodeCtx.getImageData(0, 0, img.width, img.height);
        
        // Calculate capacity: 3 channels (RGB) per pixel. 8 bits per character.
        // Leaves 1 byte for null terminator.
        const totalCapacity = Math.floor((img.width * img.height * 3) / 8) - 1;
        
        stegoCapacityTotal.textContent = totalCapacity;
        stegoCapacityUsed.textContent = stegoMessage.value.length;
        stegoCapacityInfo.classList.remove('hidden');
        
        updateEncodeButtonState();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Track Message Input Length
  stegoMessage.addEventListener('input', () => {
    stegoCapacityUsed.textContent = stegoMessage.value.length;
    updateEncodeButtonState();
  });

  function updateEncodeButtonState() {
    const totalCapacity = parseInt(stegoCapacityTotal.textContent || "0", 10);
    const msgLen = stegoMessage.value.length;
    
    if (originalEncodeData && msgLen > 0 && msgLen <= totalCapacity) {
      btnStegoEncode.removeAttribute('disabled');
      btnStegoEncode.classList.remove('bg-[#2a2a2a]', 'text-[#888888]');
      btnStegoEncode.classList.add('bg-white', 'text-black');
    } else {
      btnStegoEncode.setAttribute('disabled', 'true');
      btnStegoEncode.classList.remove('bg-white', 'text-black');
      btnStegoEncode.classList.add('bg-[#2a2a2a]', 'text-[#888888]');
    }
  }

  // Encode logic
  btnStegoEncode.addEventListener('click', () => {
    if (!originalEncodeData || !encodeCanvas) return;
    
    const message = stegoMessage.value;
    const data = new Uint8ClampedArray(originalEncodeData.data);
    
    // Convert message string to a binary sequence + 8 zero bits for null terminator
    let binaryMsg = "";
    for (let i = 0; i < message.length; i++) {
      let bin = message.charCodeAt(i).toString(2);
      while (bin.length < 8) {
        bin = "0" + bin;
      }
      binaryMsg += bin;
    }
    // Null terminator
    binaryMsg += "00000000";

    // Embed bits into RGB values (skip Alpha channel)
    let bitIdx = 0;
    for (let i = 0; i < data.length; i++) {
      // Skip Alpha channels (every 4th byte: index 3, 7, 11, etc.)
      if (i % 4 === 3) continue;

      if (bitIdx < binaryMsg.length) {
        const bit = parseInt(binaryMsg[bitIdx], 10);
        // Clear LSB and write new bit
        data[i] = (data[i] & ~1) | bit;
        bitIdx++;
      } else {
        break;
      }
    }

    // Write back to canvas
    const imgData = encodeCtx.createImageData(encodeCanvas.width, encodeCanvas.height);
    imgData.data.set(data);
    encodeCtx.putImageData(imgData, 0, 0);

    // Save as PNG
    encodeCanvas.toBlob((blob) => {
      if (stegoImageBlobUrl) URL.revokeObjectURL(stegoImageBlobUrl);
      stegoImageBlobUrl = URL.createObjectURL(blob);
      
      btnStegoDownload.href = stegoImageBlobUrl;
      btnStegoDownload.download = "stego_encoded.png";
      btnStegoDownload.classList.remove('hidden');
      
      btnStegoEncode.textContent = "ENCODING DONE";
    }, 'image/png');
  });

  // Handle Stego Image Upload for Decoding
  stegoDecodeImg.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      // Set preview image
      const previewImg = document.getElementById('stego-decode-preview');
      const previewContainer = document.getElementById('stego-decode-preview-container');
      if (previewImg && previewContainer) {
        previewImg.src = event.target.result;
        previewContainer.classList.remove('hidden');
      }

      const img = new Image();
      img.onload = function() {
        decodeCanvas = document.createElement('canvas');
        decodeCanvas.width = img.width;
        decodeCanvas.height = img.height;
        decodeCtx = decodeCanvas.getContext('2d');
        decodeCtx.drawImage(img, 0, 0);
        
        originalDecodeData = decodeCtx.getImageData(0, 0, img.width, img.height);
        
        btnStegoDecode.removeAttribute('disabled');
        btnStegoDecode.classList.remove('bg-[#2a2a2a]', 'text-[#888888]');
        btnStegoDecode.classList.add('bg-white', 'text-black');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Decode logic
  btnStegoDecode.addEventListener('click', () => {
    if (!originalDecodeData) return;
    
    const data = originalDecodeData.data;
    let binaryMsg = "";
    let decodedText = "";
    
    // Extract bits from RGB channels
    for (let i = 0; i < data.length; i++) {
      if (i % 4 === 3) continue; // Skip Alpha

      const bit = data[i] & 1;
      binaryMsg += bit;

      // Every 8 bits, reconstruct character
      if (binaryMsg.length === 8) {
        const charCode = parseInt(binaryMsg, 2);
        if (charCode === 0) {
          // Null terminator found
          break;
        }
        decodedText += String.fromCharCode(charCode);
        binaryMsg = "";
      }
    }

    stegoDecodedOutput.value = decodedText;
    btnStegoDecode.textContent = "DECODING DONE";
  });
});
