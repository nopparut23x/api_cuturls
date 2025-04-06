const express = require('express');
const knex = require('knex');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const fs = require('fs');
const { Domain } = require('domain');
const app = express();
const port = process.env.PORT || 3000;

// Setup database connection with PostgreSQL
const db = knex({
  client: 'pg',
  connection: {
    host: 'aws-0-ap-southeast-1.pooler.supabase.com', 
    user: 'postgres.qxnfijwnsbzkpamowzgz', 
    password: 'nopparut23X',
    database: 'postgres', 
    port: 6543, 
  }
});

app.use(cors());
app.use(express.json());
const checkDbConnection = async () => {
  try {
    await db.raw('SELECT 1');
    console.log('Database connection successful');
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1); // Exit if DB connection fails
  }
};

const generateShortUrl = () => {
  const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const length = 5;
  let shortUrl = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    shortUrl += characters.charAt(randomIndex);
  }
  return shortUrl;
};
app.post('/shorten', async (req, res) => {
  try {
    const { url } = req.body;
    
    // ตรวจสอบว่า URL นี้มีอยู่ในฐานข้อมูลหรือยัง
    const existingUrl = await db('urls').where('original_url', url).first();

    if (existingUrl) {
      // ถ้ามี URL นี้แล้ว ให้ส่ง short URL ที่มีอยู่กลับไป
      const domain = req.get('host');
      const fullShortenedUrl = `${domain}/${existingUrl.shortened_url}`;
      return res.json({ fullShortenedUrl, shortUrl: existingUrl.shortened_url });
    }

    // ถ้าไม่มี URL นี้ในฐานข้อมูล ให้ทำการสร้าง short URL ใหม่
    const shortUrl = generateShortUrl();

    // ดึง domain จาก request
    const domain = req.get('host');  // เช่น "localhost:3000" หรือ "cut.com"
    
    // สร้าง full URL โดยการรวม domain กับ short URL
    const fullShortenedUrl = `${domain}/${shortUrl}`;

    // บันทึกข้อมูลในฐานข้อมูล
    await db('urls').insert({ original_url: url, shortened_url: shortUrl, user_id: 1 });

    // ส่งข้อมูลกลับไป
    res.json({ fullShortenedUrl, shortUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while shortening the link' });
  }
});




app.get('/:shortUrl', async (req, res) => {
  try {
    const { shortUrl } = req.params;  // Captures the dynamic parameter from the URL
    console.log(shortUrl);  // Logs the shortUrl (e.g., "bHUDO")

    const url = await db('urls').where('shortened_url', shortUrl).first();
    if (url) {
      res.redirect(url.original_url);  // Redirects to the original URL
    } else {
      res.status(404).json({ error: 'Short URL not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while searching for the link' });
  }
});



checkDbConnection();

const deleteOldUrls = async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db('urls').where('created_at', '<', oneDayAgo).del();
    console.log('Old URLs deleted successfully');
  } catch (err) {
    console.error('Error deleting old URLs:', err);
  }
};


// เรียกใช้ทุก ๆ 24 ชั่วโมง (หรือทุก ๆ ช่วงเวลาที่คุณต้องการ)
setInterval(deleteOldUrls, 24 * 60 * 60 * 1000); // 24 ชั่วโมง

// Start server
app.listen(port, async () => {
  console.log(`Server running at ${port}`);
  // ลบข้อมูลที่เกิน 1 วันเมื่อเริ่มเซิร์ฟเวอร์
  await deleteOldUrls();
});

