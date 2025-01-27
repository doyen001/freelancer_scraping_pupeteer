const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // For downloading images

// Function to download images
async function downloadImage(url, savePath) {
  const writer = fs.createWriteStream(savePath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// Main script
(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const baseURL = 'https://www.freelancer.com/freelancers/skills/3ds-max/1';
  await page.goto(baseURL, { waitUntil: 'networkidle2' });

  // Step 1: Extract profile URLs from the main page
  const profileUrls = await page.$$eval('.FreelancerTile a[href]', links =>
    links.map(link => link.href).filter(href => href.includes('/u/'))
  );

  console.log(`Found ${profileUrls.length} profiles.`);

  // Step 2: Visit each profile and download portfolio images
  for (const profileUrl of profileUrls) {
    console.log(`Visiting profile: ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'networkidle2' });

    // Extract image URLs
    const imageUrls = await page.$$eval('img[src]', imgs =>
      imgs
        .map(img => img.src)
        .filter(src => src.includes('portfolio') || src.includes('projects')) // Adjust based on actual attributes
    );

    console.log(`Found ${imageUrls.length} portfolio images.`);

    // Step 3: Download each image
    for (const [index, imageUrl] of imageUrls.entries()) {
      const fileName = `${path.basename(profileUrl)}-image-${index + 1}.jpg`;
      const savePath = path.join(__dirname, 'downloads', fileName);

      // Ensure the download directory exists
      fs.mkdirSync(path.dirname(savePath), { recursive: true });

      console.log(`Downloading image: ${imageUrl}`);
      await downloadImage(imageUrl, savePath);
    }
  }

  await browser.close();
  console.log('All images downloaded successfully!');
})();