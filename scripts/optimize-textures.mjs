import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

function scan(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) files.push(...scan(p));
    else if (/\.(jpe?g|png|webp)$/i.test(f.name)) files.push(p);
  }
  return files;
}

async function main() {
  const images = scan('public/assets');
  let beforeBytes = 0;
  let afterBytes = 0;

  console.log('=== RESIZING TEXTURES TO MAX 1024px ===');

  for (const imgPath of images) {
    const meta = await sharp(imgPath).metadata();
    const origGpu = Math.round(meta.width * meta.height * 4 * 1.333);
    beforeBytes += origGpu;

    const maxDim = 1024;
    if (meta.width > maxDim || meta.height > maxDim) {
      const buffer = await fs.promises.readFile(imgPath);
      let transform = sharp(buffer).resize({
        width: maxDim,
        height: maxDim,
        fit: 'inside',
        withoutEnlargement: true
      });

      if (meta.format === 'jpeg' || meta.format === 'jpg') {
        transform = transform.jpeg({ quality: 86, mozjpeg: true });
      } else if (meta.format === 'png') {
        transform = transform.png({ compressionLevel: 8 });
      }

      await transform.toFile(imgPath + '.tmp');
      await fs.promises.rename(imgPath + '.tmp', imgPath);

      const newMeta = await sharp(imgPath).metadata();
      const newGpu = Math.round(newMeta.width * newMeta.height * 4 * 1.333);
      afterBytes += newGpu;

      console.log(`✓ ${path.basename(imgPath)}: ${meta.width}x${meta.height} -> ${newMeta.width}x${newMeta.height} (${(origGpu/1024/1024).toFixed(2)}MB -> ${(newGpu/1024/1024).toFixed(2)}MB GPU)`);
    } else {
      afterBytes += origGpu;
      console.log(`- ${path.basename(imgPath)}: ${meta.width}x${meta.height} (already <= ${maxDim}px)`);
    }
  }

  console.log('\n=== GPU MEMORY SUMMARY ===');
  console.log(`Before: ${(beforeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`After:  ${(afterBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Saved:  ${((beforeBytes - afterBytes) / 1024 / 1024).toFixed(2)} MB (-${Math.round(((beforeBytes - afterBytes) / beforeBytes) * 100)}%)`);
}

main().catch(console.error);

