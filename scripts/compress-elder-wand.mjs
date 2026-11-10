import { readFileSync, writeFileSync } from 'fs';
import sharp from 'sharp';

async function compressElderWand() {
  const inputPath = 'public/assets/the_elder_wand.glb';
  const buf = readFileSync(inputPath);

  const magic = buf.readUInt32LE(0);
  const version = buf.readUInt32LE(4);
  const totalLength = buf.readUInt32LE(8);
  const jsonChunkLength = buf.readUInt32LE(12);
  const jsonChunkType = buf.readUInt32LE(16);

  const jsonStr = buf.toString('utf8', 20, 20 + jsonChunkLength);
  const gltf = JSON.parse(jsonStr);

  const binChunkOffset = 20 + jsonChunkLength;
  const binChunkLength = buf.readUInt32LE(binChunkOffset);
  const binChunkType = buf.readUInt32LE(binChunkOffset + 4);
  const binDataOffset = binChunkOffset + 8;
  const originalBin = buf.subarray(binDataOffset, binDataOffset + binChunkLength);

  console.log(`Original GLB: ${(totalLength / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Images count: ${gltf.images?.length}`);

  // Determine non-image buffer data (geometry, accessors, etc.)
  // Images use bufferViews gltf.images[i].bufferView
  const imageBufferViewIndices = new Set(gltf.images.map(img => img.bufferView));
  
  // Find max byteOffset among non-image bufferViews to keep original geometry chunk
  let nonImageMaxEnd = 0;
  gltf.bufferViews.forEach((bv, idx) => {
    if (!imageBufferViewIndices.has(idx)) {
      const end = (bv.byteOffset || 0) + bv.byteLength;
      if (end > nonImageMaxEnd) nonImageMaxEnd = end;
    }
  });

  // Align nonImageMaxEnd to 4 bytes
  nonImageMaxEnd = Math.ceil(nonImageMaxEnd / 4) * 4;
  console.log(`Non-image geometry buffer size: ${(nonImageMaxEnd / 1024).toFixed(1)} KB`);

  const geometryBuffer = Buffer.from(originalBin.subarray(0, nonImageMaxEnd));

  // Process and compress each image
  const newImageBuffers = [];
  for (let i = 0; i < gltf.images.length; i++) {
    const img = gltf.images[i];
    const bv = gltf.bufferViews[img.bufferView];
    const imgRaw = originalBin.subarray(bv.byteOffset, bv.byteOffset + bv.byteLength);

    let compressed;
    if (i === 0) {
      // Base color map: compress to 1024x1024 JPEG high quality
      compressed = await sharp(imgRaw)
        .resize(1024, 1024, { fit: 'inside' })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
      img.mimeType = 'image/jpeg';
    } else if (i === 2) {
      // Normal map: 1024x1024 lossless PNG
      compressed = await sharp(imgRaw)
        .resize(1024, 1024, { fit: 'inside' })
        .png({ compressionLevel: 9 })
        .toBuffer();
      img.mimeType = 'image/png';
    } else {
      // Metallic/Roughness & Specular: 1024x1024 lossless PNG
      compressed = await sharp(imgRaw)
        .resize(1024, 1024, { fit: 'inside' })
        .png({ compressionLevel: 9 })
        .toBuffer();
      img.mimeType = 'image/png';
    }

    console.log(`Image ${i} (${img.mimeType}): ${(imgRaw.length / 1024).toFixed(1)} KB -> ${(compressed.length / 1024).toFixed(1)} KB`);
    newImageBuffers.push(compressed);
  }

  // Build new binary chunk with 4-byte alignment
  const binParts = [geometryBuffer];
  let currentOffset = geometryBuffer.length;

  for (let i = 0; i < gltf.images.length; i++) {
    const img = gltf.images[i];
    const bv = gltf.bufferViews[img.bufferView];
    const imgBuf = newImageBuffers[i];

    // Align to 4 bytes
    const padLen = (4 - (currentOffset % 4)) % 4;
    if (padLen > 0) {
      binParts.push(Buffer.alloc(padLen, 0));
      currentOffset += padLen;
    }

    bv.byteOffset = currentOffset;
    bv.byteLength = imgBuf.length;

    binParts.push(imgBuf);
    currentOffset += imgBuf.length;
  }

  // Final 4-byte padding for entire bin chunk
  const finalPad = (4 - (currentOffset % 4)) % 4;
  if (finalPad > 0) {
    binParts.push(Buffer.alloc(finalPad, 0));
    currentOffset += finalPad;
  }

  const newBinChunk = Buffer.concat(binParts);
  gltf.buffers[0].byteLength = newBinChunk.length;

  // Build new JSON chunk with 4-byte padding (trailing spaces 0x20)
  let newJsonStr = JSON.stringify(gltf);
  const jsonPad = (4 - (Buffer.byteLength(newJsonStr) % 4)) % 4;
  if (jsonPad > 0) {
    newJsonStr += ' '.repeat(jsonPad);
  }
  const newJsonBuffer = Buffer.from(newJsonStr, 'utf8');

  // Construct new GLB buffer
  const newHeader = Buffer.alloc(12);
  const newTotalLength = 12 + 8 + newJsonBuffer.length + 8 + newBinChunk.length;
  newHeader.writeUInt32LE(0x46546C67, 0); // 'glTF'
  newHeader.writeUInt32LE(2, 4);          // version 2
  newHeader.writeUInt32LE(newTotalLength, 8);

  const newJsonHeader = Buffer.alloc(8);
  newJsonHeader.writeUInt32LE(newJsonBuffer.length, 0);
  newJsonHeader.writeUInt32LE(0x4E4F534A, 4); // 'JSON'

  const newBinHeader = Buffer.alloc(8);
  newBinHeader.writeUInt32LE(newBinChunk.length, 0);
  newBinHeader.writeUInt32LE(0x004E4942, 4); // 'BIN\0'

  const finalGlb = Buffer.concat([
    newHeader,
    newJsonHeader,
    newJsonBuffer,
    newBinHeader,
    newBinChunk
  ]);

  writeFileSync(inputPath, finalGlb);
  console.log(`\nSUCCESS: Compressed GLB written to ${inputPath}`);
  console.log(`New GLB file size: ${(finalGlb.length / (1024 * 1024)).toFixed(2)} MB (saved ${((totalLength - finalGlb.length) / (1024 * 1024)).toFixed(2)} MB, -${(((totalLength - finalGlb.length) / totalLength) * 100).toFixed(1)}%)`);
}

compressElderWand().catch(console.error);

