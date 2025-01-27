const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // For downloading images
const sharp = require('sharp');

// Function to download images
async function downloadImage(url, savePath) {
  const writer = fs.createWriteStream(savePath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer'
  });
  await sharp(response.data)
    .resize(500, 500, {
      fit: 'cover', // Crop or adjust the image to exactly fit 500x500
    })
    .toFile(savePath);
}

// Main script
(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const baseURL = 'https://www.freelancer.com/freelancers/skills/3ds-max/1';
  await page.goto(baseURL, { waitUntil: 'networkidle2' });

  // Step 1: Extract profile URLs from the main page
  const profileUrls = await page.$$eval('.find-freelancer-username[href]', links =>
    links.map(link => link.href).filter(href => href.includes('/u/'))
  );

  console.log(`Found ${profileUrls.length} profiles.`);

  // Step 2: Visit each profile and download portfolio images
  for (const profileUrl of profileUrls) {
    console.log(`Visiting profile: ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'networkidle2' });

    const userName = await page.$eval(
      'fl-heading.Username-userId.Username-userId-heading.ng-star-inserted > h3',
      (element) => element.textContent.trim()
    );
    const countryName = await page.$eval('div.UserSummaryInformation .SupplementaryInfo .NativeElement.ng-star-inserted',
      (element) => element.textContent.split('(')[0].trim());

    // Extract image URLs
    const imageUrls = await page.$$eval('.PortfolioItemCard-file-container.ng-star-inserted img', imgs =>
      imgs
        .map(img => img.src)
    );

    console.log(`Found ${imageUrls.length} portfolio images.`);
    // Step 3: Download each image
    for (const [index, imageUrl] of imageUrls.entries()) {
      const fileName = `${userName}-${countryName}-${index + 1}.jpg`;
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