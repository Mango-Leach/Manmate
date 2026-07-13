const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, '../public/logo.png');
const sizes = [192, 512];

(async () => {
  for (const size of sizes) {
    await sharp(src)
      .resize(size, size, { fit: 'contain', background: { r: 245, g: 241, b: 232, alpha: 1 } })
      .png()
      .toFile(path.join(__dirname, `../public/logo-${size}.png`));
    console.log(`Generated logo-${size}.png`);
  }
})();
