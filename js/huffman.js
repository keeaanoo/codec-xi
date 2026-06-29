// Huffman Image Compression / Decompression Logic

class HuffmanNode {
  constructor(symbol, freq, left = null, right = null) {
    this.symbol = symbol;
    this.freq = freq;
    this.left = left;
    this.right = right;
  }
  isLeaf() {
    return this.left === null && this.right === null;
  }
}

// Build tree from frequency map
function buildHuffmanTree(frequencies) {
  const pq = [];
  for (const [symbolStr, freq] of Object.entries(frequencies)) {
    const symbol = parseInt(symbolStr, 10);
    pq.push(new HuffmanNode(symbol, freq));
  }

  // Sort helper
  const sortPQ = () => pq.sort((a, b) => a.freq - b.freq);

  while (pq.length > 1) {
    sortPQ();
    const left = pq.shift();
    const right = pq.shift();
    const parent = new HuffmanNode(null, left.freq + right.freq, left, right);
    pq.push(parent);
  }

  return pq[0] || null;
}

// Generate codes from the tree
function generateCodes(node, prefix = "", codes = {}) {
  if (!node) return codes;
  if (node.isLeaf()) {
    codes[node.symbol] = prefix;
  } else {
    generateCodes(node.left, prefix + "0", codes);
    generateCodes(node.right, prefix + "1", codes);
  }
  return codes;
}

// Pack bits into a Uint8Array
function packBits(bitString) {
  const byteLen = Math.ceil(bitString.length / 8);
  const packed = new Uint8Array(byteLen);
  for (let i = 0; i < bitString.length; i++) {
    if (bitString[i] === '1') {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = 7 - (i % 8);
      packed[byteIdx] |= (1 << bitIdx);
    }
  }
  return packed;
}

// Unpack bits from a Uint8Array
function unpackBits(packedBytes, totalBits) {
  let bitString = "";
  for (let i = 0; i < packedBytes.length; i++) {
    const byteVal = packedBytes[i];
    for (let j = 7; j >= 0; j--) {
      if (bitString.length < totalBits) {
        bitString += ((byteVal >> j) & 1) === 1 ? '1' : '0';
      } else {
        break;
      }
    }
  }
  return bitString;
}

// Global UI interaction for Huffman Tab
document.addEventListener('DOMContentLoaded', () => {
  const huffInputImg = document.getElementById('huff-input-img');
  const huffInputFile = document.getElementById('huff-input-file');
  const btnHuffCompress = document.getElementById('btn-huff-compress');
  const btnHuffDecompress = document.getElementById('btn-huff-decompress');
  
  const huffOrigPreviewContainer = document.getElementById('huff-orig-preview-container');
  const huffOrigPreview = document.getElementById('huff-orig-preview');
  const huffStatsContainer = document.getElementById('huff-stats-container');
  
  const huffOrigSize = document.getElementById('huff-orig-size');
  const huffCompSize = document.getElementById('huff-comp-size');
  const huffRatio = document.getElementById('huff-ratio');
  const btnHuffDownloadComp = document.getElementById('btn-huff-download-comp');
  
  const huffDecompContainer = document.getElementById('huff-decomp-container');
  const huffDecompPreview = document.getElementById('huff-decomp-preview');
  const btnHuffDownloadDecomp = document.getElementById('btn-huff-download-decomp');

  let originalImageData = null;
  let compressedBlob = null;
  let decompressedImgUrl = null;

  // Handle image upload for compression
  huffInputImg.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      huffOrigPreview.src = event.target.result;
      huffOrigPreviewContainer.classList.remove('hidden');
      
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        originalImageData = ctx.getImageData(0, 0, img.width, img.height);
        
        btnHuffCompress.removeAttribute('disabled');
        btnHuffCompress.classList.remove('bg-[#2a2a2a]', 'text-[#888888]');
        btnHuffCompress.classList.add('bg-white', 'text-black');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Compress Logic
  btnHuffCompress.addEventListener('click', () => {
    if (!originalImageData) return;
    btnHuffCompress.disabled = true;
    btnHuffCompress.textContent = "COMPRESSING...";

    setTimeout(() => {
      try {
        const data = originalImageData.data; // RGBA array
        const width = originalImageData.width;
        const height = originalImageData.height;
        
        // 1. Calculate frequencies
        const frequencies = {};
        for (let i = 0; i < data.length; i++) {
          frequencies[data[i]] = (frequencies[data[i]] || 0) + 1;
        }

        // 2. Build Huffman Tree
        const root = buildHuffmanTree(frequencies);
        const codes = generateCodes(root);

        // 3. Generate Bitstream
        let bitstream = "";
        for (let i = 0; i < data.length; i++) {
          bitstream += codes[data[i]];
        }

        // 4. Pack Bitstream
        const packedData = packBits(bitstream);

        // 5. Serialize Structure
        // Magic header: HUFF (4 bytes)
        // Width (4 bytes, Uint32)
        // Height (4 bytes, Uint32)
        // Symbol count (1 byte, stored as symbolCount - 1)
        // For each symbol: 1 byte value + 4 bytes frequency (Uint32)
        // Total Bits in bitstream (4 bytes, Uint32)
        // Packed bitstream bytes...

        const freqKeys = Object.keys(frequencies);
        const symbolCount = freqKeys.length;
        const headerSize = 4 + 4 + 4 + 1 + (symbolCount * 5) + 4;
        
        const fileBuffer = new ArrayBuffer(headerSize + packedData.length);
        const view = new DataView(fileBuffer);
        
        // Magic
        view.setUint8(0, 72); // H
        view.setUint8(1, 85); // U
        view.setUint8(2, 70); // F
        view.setUint8(3, 70); // F
        
        view.setUint32(4, width);
        view.setUint32(8, height);
        view.setUint8(12, symbolCount - 1); // Store 0-255 representing 1-256
        
        let byteOffset = 13;
        for (const [symbolStr, freq] of Object.entries(frequencies)) {
          const symbol = parseInt(symbolStr, 10);
          view.setUint8(byteOffset, symbol);
          view.setUint32(byteOffset + 1, freq);
          byteOffset += 5;
        }
        
        view.setUint32(byteOffset, bitstream.length);
        
        const finalFileBytes = new Uint8Array(fileBuffer);
        finalFileBytes.set(packedData, headerSize);

        // Stats calculation
        const origSizeVal = data.length; // Raw RGBA size
        const compSizeVal = finalFileBytes.length;
        const ratioVal = ((1 - (compSizeVal / origSizeVal)) * 100).toFixed(2) + "%";

        huffOrigSize.textContent = formatBytes(origSizeVal);
        huffCompSize.textContent = formatBytes(compSizeVal);
        huffRatio.textContent = ratioVal;
        
        huffStatsContainer.classList.remove('hidden');

        // Create download link
        compressedBlob = new Blob([finalFileBytes], { type: "application/octet-stream" });
        btnHuffDownloadComp.href = URL.createObjectURL(compressedBlob);
        btnHuffDownloadComp.download = "image.huff";
        btnHuffDownloadComp.classList.remove('hidden');

        btnHuffCompress.textContent = "COMPRESSION DONE";
      } catch (err) {
        console.error(err);
        btnHuffCompress.textContent = "COMPRESSION FAILED";
      }
    }, 50);
  });

  // Handle compressed file upload for decompression
  huffInputFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    btnHuffDecompress.removeAttribute('disabled');
    btnHuffDecompress.classList.remove('bg-[#2a2a2a]', 'text-[#888888]');
    btnHuffDecompress.classList.add('bg-white', 'text-black');
  });

  // Decompress Logic
  btnHuffDecompress.addEventListener('click', () => {
    const file = huffInputFile.files[0];
    if (!file) return;

    btnHuffDecompress.disabled = true;
    btnHuffDecompress.textContent = "DECOMPRESSING...";

    const reader = new FileReader();
    reader.onload = function(event) {
      setTimeout(() => {
        try {
          const buffer = event.target.result;
          const view = new DataView(buffer);
          
          // Verify Magic HUFF
          if (view.getUint8(0) !== 72 || view.getUint8(1) !== 85 || view.getUint8(2) !== 70 || view.getUint8(3) !== 70) {
            throw new Error("Invalid .huff file header.");
          }

          const width = view.getUint32(4);
          const height = view.getUint32(8);
          const symbolCount = view.getUint8(12) + 1;
          
          const frequencies = {};
          let byteOffset = 13;
          for (let i = 0; i < symbolCount; i++) {
            const symbol = view.getUint8(byteOffset);
            const freq = view.getUint32(byteOffset + 1);
            frequencies[symbol] = freq;
            byteOffset += 5;
          }

          const totalBits = view.getUint32(byteOffset);
          byteOffset += 4; // headerSize

          const packedData = new Uint8Array(buffer, byteOffset);
          const bitstream = unpackBits(packedData, totalBits);

          // Rebuild Huffman Tree
          const root = buildHuffmanTree(frequencies);
          
          // Decode bitstream
          const decodedPixels = new Uint8ClampedArray(width * height * 4);
          let current = root;
          let pixelIndex = 0;

          for (let i = 0; i < bitstream.length; i++) {
            if (bitstream[i] === '0') {
              current = current.left;
            } else {
              current = current.right;
            }

            if (current.isLeaf()) {
              decodedPixels[pixelIndex++] = current.symbol;
              current = root;
            }
          }

          // Create canvas and render image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          const imgData = ctx.createImageData(width, height);
          imgData.data.set(decodedPixels);
          ctx.putImageData(imgData, 0, 0);

          // Preview
          canvas.toBlob((blob) => {
            if (decompressedImgUrl) URL.revokeObjectURL(decompressedImgUrl);
            decompressedImgUrl = URL.createObjectURL(blob);
            huffDecompPreview.src = decompressedImgUrl;
            huffDecompContainer.classList.remove('hidden');

            btnHuffDownloadDecomp.href = decompressedImgUrl;
            btnHuffDownloadDecomp.download = "restored_image.png";
            btnHuffDownloadDecomp.classList.remove('hidden');

            btnHuffDecompress.textContent = "DECOMPRESSION DONE";
          }, 'image/png');

        } catch (err) {
          console.error(err);
          btnHuffDecompress.textContent = "DECOMPRESSION FAILED";
          alert("Error: " + err.message);
        }
      }, 50);
    };
    reader.readAsArrayBuffer(file);
  });
});
