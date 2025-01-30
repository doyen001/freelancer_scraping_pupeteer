const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // For downloading images
const sharp = require('sharp');

const PROGRESS_FILE = 'progress.json';

let downloadedImages = new Set();
if (fs.existsSync(PROGRESS_FILE)) {
  downloadedImages = new Set(JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')));
}

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

  for (let i = 1; i < 1000; i++) {
    if (i === 1) {
      const baseURL = `https://www.freelancer.com/freelancers/skills/3ds-max/1`;
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
      await new Promise(resolve => setTimeout(resolve, 15000));
      await page.click('#online_only');
      await new Promise(resolve => setTimeout(resolve, 10000));
    } else {
      await page.waitForSelector('#display_div > div:nth-child(1) > div.ns_pagination.is-desktop-only > ul > li:nth-child(7) > a', { visible: true, timeout: 10000 });
      await page.click('#display_div > div:nth-child(1) > div.ns_pagination.is-desktop-only > ul > li:nth-child(7) > a');
    }
    // Step 1: Extract profile URLs from the main page
    const profileUrls = await page.$$eval('.find-freelancer-username[href]', links =>
      links.map(link => link.href)
    );

    if (profileUrls.length === 0) {
      console.log(`Found ${profileUrls.length} profiles.`);
      await browser.close();
      return;
    } else {
      console.log(`Found ${profileUrls.length} profiles.`);
      const profilePage = await browser.newPage();
      // Step 2: Visit each profile and download portfolio images
      for (const profileUrl of profileUrls) {
        console.log(`Visiting profile: ${profileUrl}`);

        try {
          await profilePage.goto(profileUrl, { waitUntil: 'domcontentloaded' });
          const namePart = profileUrl.split('/');
          const userName = namePart[namePart.length - 1];
          // Extract image URLs
          const countryName = await profilePage.$eval('div.UserSummaryInformation .SupplementaryInfo .NativeElement.ng-star-inserted',
            (element) => element.textContent.split('(')[0].trim());

          const imageUrls = await profilePage.$$eval('.PortfolioItemCard-file-container.ng-star-inserted img', imgs =>
            imgs
              .map(img => img.src).filter((item) => item.includes("jpg"))
          );
          console.log(`Found ${imageUrls.length} portfolio images.`);
          // Step 3: Download each image
          for (const [index, imageUrl] of imageUrls.entries()) {
            const fileName = `${userName}-${countryName}-${index + 1}.jpg`;
            const savePath = path.join(__dirname, `downloads/${countryName}`, fileName);

            if (downloadedImages.has(imageUrl)) {
              console.log(`Skipping: ${imageUrl} (already downloaded)`);
              continue;
            }
            // Ensure the download directory exists
            fs.mkdirSync(path.dirname(savePath), { recursive: true });

            console.log(`Downloading image: ${imageUrl}`);
            await downloadImage(imageUrl, savePath);
            downloadedImages.add(imageUrl);
            fs.writeFileSync(PROGRESS_FILE, JSON.stringify(Array.from(downloadedImages), null, 2));
          }
        } catch (error) {
          console.log('error reason: ', error);
          continue;
        }
      }
      await profilePage.close();
    }

  }


  await browser.close();
  console.log('All images downloaded successfully!');
})();