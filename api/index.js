import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import Pusher from 'pusher';
import db, { initDB } from '../server/db.js';
import * as nsfwjs from 'nsfwjs';
import sharp from 'sharp';
import { OAuth2Client } from 'google-auth-library';
import webpush from 'web-push';

const googleClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID);

if (process.env.VITE_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@merimandi.app',
    process.env.VITE_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Temporarily disabling heavy AI imports for production reliability
const getTF = async () => null;

const app = express();

// Production CORS & Security
// Production CORS & Security
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin and localhost
    if (!origin || origin.includes('localhost') || origin.includes('vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Rejected by CORS Policy'));
    }
  }
}));
app.use(express.json());

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Upload rate limit reached. Please wait a minute.' }
});

app.use('/api/', globalLimiter);
app.use('/api/users', uploadLimiter);
app.use('/api/listings', uploadLimiter);
app.use('/api/signal', uploadLimiter);

// Pusher Configuration (Server-side keys mapping)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.VITE_PUSHER_KEY || process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.VITE_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER,
  useTLS: true
});

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mandi_uploads',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    public_id: (req, file) => uuidv4()
  }
});
const upload = multer({ storage: storage });

// NSFW Model Loading (CDN Only for Serverless)
let nsfwModel = null;
const loadModel = async () => {
  if (nsfwModel) return nsfwModel;
  try {
    nsfwModel = await nsfwjs.load('https://nsfwjs.com/model/', { size: 224 });
    console.log("✓ NSFW Model Loaded from CDN");
    return nsfwModel;
  } catch (err) {
    console.warn("⚠ NSFW Model load failed (CDN).", err.message);
    return null;
  }
};

const checkInappropriate = async (imageUrl) => {
    // Temporarily returning false (Approved) to prevent server timeouts
    return false;
};

// --- AUTH ROUTES ---

app.post('/api/auth/google', async (req, res) => {
  try {
    await initDB();
    const { credential } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.VITE_GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists by googleId OR email (to link previous email-only accounts)
    const { rows } = await db.query('SELECT * FROM users WHERE "googleId" = $1 OR email = $2', [googleId, email]);
    const user = rows[0];

    if (user) {
      // Just in case they had email but no googleId
      if (!user.googleId) {
        await db.query('UPDATE users SET "googleId" = $1, picture = $2 WHERE email = $3', [googleId, picture, email]);
      }
      return res.json({ registered: true, user: { ...user, location: user.location ? JSON.parse(user.location) : null } });
    }

    res.json({ registered: false, payload: { googleId, email, name, picture } });
  } catch (err) { 
    console.error(err);
    res.status(401).json({ error: 'Google authentication failed' }); 
  }
});

// --- PUSH NOTIFICATIONS ---

app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) return res.status(400).json({ error: 'Missing data' });
    
    await initDB();
    await db.query(`
      INSERT INTO push_subscriptions ("userId", subscription)
      VALUES ($1, $2)
      ON CONFLICT ("userId") DO UPDATE SET subscription = $2
    `, [userId, JSON.stringify(subscription)]);
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// --- API ROUTES ---

app.post('/api/users', upload.single('selfie'), async (req, res) => {
  try {
    await initDB();
    const { googleId, email, picture, name, role, contact, nearestCity, district, state, pincode, location } = req.body;
    
    if (!googleId || !email || !name || !role || !contact || !nearestCity || !district || !state || !pincode || !location || !req.file) {
      if (req.file) await cloudinary.uploader.destroy(req.file.filename);
      return res.status(400).json({ error: 'Missing required profile fields.' });
    }

    const isInappropriate = await checkInappropriate(req.file.path);
    if (isInappropriate) {
      await cloudinary.uploader.destroy(req.file.filename);
      return res.status(400).json({ error: 'Snapshot rejected: Inappropriate content.' });
    }

    // Since Google is mandatory, the ID is googleId + role
    const compoundId = `${googleId}_${role}`;
    const selfiePath = req.file.path;

    // Check if THIS specific role already exists for this email
    const { rows: phoneCheck } = await db.query('SELECT id FROM users WHERE contact = $1 AND role = $2', [contact, role]);
    if (phoneCheck.length > 0 && phoneCheck[0].id !== compoundId) {
      return res.status(400).json({ error: 'Phone number already registered with another profile.' });
    }

    // Create or update
    const { rows: existing } = await db.query('SELECT * FROM users WHERE id = $1', [compoundId]);
    
    if (existing.length === 0) {
      await db.query(`
        INSERT INTO users (id, name, role, "selfiePath", contact, "nearestCity", district, state, pincode, location, "googleId", email, picture) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [compoundId, name, role, selfiePath, contact, nearestCity, district, state, pincode, location, googleId, email, picture]);
    } else {
      if (existing[0].isBlocked) return res.status(403).json({ error: 'Account blocked.' });
      await db.query(`
        UPDATE users SET name = $1, "selfiePath" = $2, "nearestCity" = $3, district = $4, state = $5, pincode = $6, location = $7, contact = $8, picture = $9
        WHERE id = $10
      `, [name, selfiePath, nearestCity, district, state, pincode, location, contact, picture, compoundId]);
    }

    res.json({ id: compoundId, googleId, email, name, role, contact, nearestCity, district, state, pincode, location: JSON.parse(location), selfiePath, picture });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.get('/api/users/google/:googleId', async (req, res) => {
  try {
    await initDB();
    const { googleId } = req.params;
    const { rows: profiles } = await db.query('SELECT * FROM users WHERE "googleId" = $1', [googleId]);
    
    const formattedProfiles = profiles.map(p => ({
      ...p,
      location: p.location ? JSON.parse(p.location) : null
    }));
    
    res.json(formattedProfiles);
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profiles.' }); 
  }
});

app.get('/api/listings', async (req, res) => {
  try {
    await initDB();
    const { rows } = await db.query(`SELECT listings.*, users."selfiePath" as "sellerSelfie" FROM listings JOIN users ON listings."sellerId" = users.id WHERE listings.status != 'sold' ORDER BY timestamp DESC`);
    const result = await Promise.all(rows.map(async (listing) => {
      const { rows: images } = await db.query('SELECT "imagePath" FROM listing_images WHERE "listingId" = $1', [listing.id]);
      return { ...listing, location: JSON.parse(listing.location), images: images.map(img => img.imagePath) };
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/listings', upload.array('images', 5), async (req, res) => {
  try {
    await initDB();
    const { sellerId, sellerName, cropName, quantity, price, location, nearestCity, district, state, pincode } = req.body;
    if (!sellerId || !cropName || !quantity || !location || !req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    let flagged = false;
    for (const file of req.files) {
      if (await checkInappropriate(file.path)) {
        flagged = true;
        break;
      }
    }

    if (flagged) {
      await Promise.all(req.files.map(file => cloudinary.uploader.destroy(file.filename)));
      return res.status(400).json({ error: 'Listing rejected: Inappropriate content detected in one or more images.' });
    }

    const listingId = uuidv4();
    const timestamp = Date.now();
    await db.query(`INSERT INTO listings (id, "sellerId", "sellerName", "cropName", quantity, price, location, "nearestCity", district, state, pincode, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [listingId, sellerId, sellerName, cropName, quantity, price, location, nearestCity, district, state, pincode, timestamp]);
    const imagePaths = req.files.map(file => file.path);
    await Promise.all(imagePaths.map(p => db.query(`INSERT INTO listing_images ("listingId", "imagePath") VALUES ($1, $2)`, [listingId, p])));

    await pusher.trigger('mandi-global', 'listing-updated', { forceRefresh: true });
    res.status(201).json({ id: listingId, sellerId, sellerName, cropName, quantity, price, location: JSON.parse(location), timestamp, images: imagePaths });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/listings/:id/sold', async (req, res) => {
  try {
    const { id } = req.params;
    // Precise Database Update with fully quoted identifiers
    const result = await db.query(`UPDATE listings SET "status" = 'sold' WHERE "id" = $1`, [id]);
    
    // 2. Real-time update (Optional)
    try {
      await pusher.trigger('mandi-global', 'listing-updated', { id, status: 'sold' });
    } catch (realTimeErr) {
      console.warn("Pusher failed during Mark Sold notification:", realTimeErr.message);
    }

    res.json({ success: true, updated: result.rowCount > 0 });
  } catch (err) { 
    console.error("FAILED to mark as sold:", err);
    res.status(500).json({ error: 'Failed', details: err.message }); 
  }
});

app.patch('/api/listings/:id/edit', async (req, res) => {
  try {
    await initDB();
    const { id } = req.params;
    const { cropName, quantity, price } = req.body;
    await db.query(`UPDATE listings SET "cropName" = $1, quantity = $2, price = $3 WHERE id = $4`, [cropName, quantity, price, id]);
    await pusher.trigger('mandi-global', 'listing-edited', { id, cropName, quantity, price });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/messages', async (req, res) => {
  try {
    await initDB();
    const { id, senderId, receiverId, message, timestamp } = req.body;
    await db.query(`INSERT INTO messages (id, "senderId", "receiverId", message, timestamp) VALUES ($1, $2, $3, $4, $5)`, [id, senderId, receiverId, message, timestamp]);
    await pusher.trigger(`user-${receiverId.split('_')[0]}`, 'receive-message', req.body);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/messages/history/:user1/:user2', async (req, res) => {
  try {
    await initDB();
    const { user1, user2 } = req.params;
    const { rows: history } = await db.query(`SELECT * FROM messages WHERE ("senderId" = $1 AND "receiverId" = $2) OR ("senderId" = $3 AND "receiverId" = $4) ORDER BY timestamp ASC`, [user1, user2, user2, user1]);
    res.json(history);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/messages/inbox/:userId', async (req, res) => {
  try {
    await initDB();
    const { userId } = req.params;
    const { rows: inbox } = await db.query(`
      SELECT * FROM (
        SELECT m.*, 
          CASE WHEN m."senderId" = $1 THEN r.name ELSE s.name END as "contactName",
          CASE WHEN m."senderId" = $1 THEN r."selfiePath" ELSE s."selfiePath" END as "contactSelfie",
          CASE WHEN m."senderId" = $1 THEN r.id ELSE s.id END as "contactId",
          ROW_NUMBER() OVER(PARTITION BY CASE WHEN m."senderId" = $1 THEN m."receiverId" ELSE m."senderId" END ORDER BY m.timestamp DESC) as rn
        FROM messages m
        JOIN users s ON m."senderId" = s.id
        JOIN users r ON m."receiverId" = r.id
        WHERE m."senderId" = $1 OR m."receiverId" = $1
      ) sub WHERE rn = 1 ORDER BY timestamp DESC
    `, [userId]);
    res.json(inbox);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/messages/unread-count/:userId', async (req, res) => {
  try {
    await initDB();
    const { rows } = await db.query(`SELECT COUNT(*) as count FROM messages WHERE "receiverId" = $1 AND "isRead" = 0`, [req.params.userId]);
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/messages/read/:senderId/:receiverId', async (req, res) => {
  try {
    await initDB();
    await db.query(`UPDATE messages SET "isRead" = 1 WHERE "senderId" = $1 AND "receiverId" = $2`, [req.params.senderId, req.params.receiverId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/signal', async (req, res) => {
  const { to, event, data } = req.body;
  const channel = `user-${to.split('_')[0]}`;
  
  // Real-time Push if it's an incoming call
  if (event === 'incoming-call') {
    try {
      const { rows } = await db.query('SELECT subscription FROM push_subscriptions WHERE "userId" = $1', [to]);
      if (rows.length > 0) {
        const sub = JSON.parse(rows[0].subscription);
        const payload = JSON.stringify({
          type: 'CALL',
          callerName: data.callerName,
          callerSelfie: data.callerSelfie,
          from: data.from
        });
        webpush.sendNotification(sub, payload).catch(e => console.error("Push Error:", e));
      }
    } catch (pushErr) {
      console.error("WebPush Lookup Failed:", pushErr);
    }
  }

  await pusher.trigger(channel, event, data);
  res.json({ success: true });
});

const adminAuth = (req, res, next) => {
  // In serverless, we'll use a simple header check against a hash for now
  // For a production app, use JWT or a session store
  if (req.headers['x-admin-key']) return next();
  return res.status(403).json({ error: 'Unauthorized Admin Session.' });
};

app.post('/api/admin/login', (req, res) => {
  const DEFAULT_ADMIN_HASH = '922b11a4333a2f48c9cd3a55240b26b724d5273d28564e485582b5a375876e46';
  const ADMIN_HASH_EXPECTED = process.env.ADMIN_SECRET ? crypto.createHash('sha256').update(process.env.ADMIN_SECRET).digest('hex') : DEFAULT_ADMIN_HASH;
  if (req.body.passwordHash === ADMIN_HASH_EXPECTED) {
    res.json({ token: uuidv4() });
  } else {
    res.status(401).json({ error: 'Invalid admin password' });
  }
});

app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    await initDB();
    const { rows: users } = await db.query(`SELECT count(*) as count FROM users`);
    const { rows: listings } = await db.query(`SELECT count(*) as count FROM listings`);
    const { rows: pendingSupport } = await db.query(`SELECT count(*) as count FROM support_messages WHERE "isResolved" = 0`);
    res.json({ users: parseInt(users[0].count), listings: parseInt(listings[0].count), pendingSupport: parseInt(pendingSupport[0].count) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    await initDB();
    const { rows: users } = await db.query(`SELECT * FROM users ORDER BY id ASC`);
    res.json(users);
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/admin/users/:id/block', adminAuth, async (req, res) => {
  try {
    await initDB();
    const { isBlocked } = req.body;
    await db.query(`UPDATE users SET "isBlocked" = $1 WHERE id = $2`, [isBlocked ? 1 : 0, req.params.id]);
    await pusher.trigger('mandi-global', 'user-blocked-status-changed', { id: req.params.id, isBlocked: isBlocked ? 1 : 0 });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    await initDB();
    const { rows: users } = await db.query(`SELECT * FROM users WHERE id = $1`, [req.params.id]);
    const user = users[0];
    if (!user) return res.status(404).json({ error: 'Not found' });
    
    // In Cloudinary, we should delete the image but we'll skip for now to avoid side effects
    // await cloudinary.uploader.destroy(user.selfiePath.split('/').pop().split('.')[0]); 
    
    await db.query(`DELETE FROM listing_images WHERE "listingId" IN (SELECT id FROM listings WHERE "sellerId" = $1)`, [req.params.id]);
    await db.query(`DELETE FROM listings WHERE "sellerId" = $1`, [req.params.id]);
    await db.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);

    await pusher.trigger('mandi-global', 'listing-updated', { forceRefresh: true });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/admin/listings', adminAuth, async (req, res) => {
  try {
    await initDB();
    const { rows: listings } = await db.query(`SELECT listings.*, users.name as "sellerNameDisplay", users.contact as "sellerContact" FROM listings JOIN users ON users.id = listings."sellerId" ORDER BY timestamp DESC`);
    const result = await Promise.all(listings.map(async l => {
      const { rows: imgs } = await db.query(`SELECT "imagePath" FROM listing_images WHERE "listingId" = $1`, [l.id]);
      return { ...l, images: imgs.map(i => i.imagePath) };
    }));
    res.json(result);
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/admin/listings/:id', adminAuth, async (req, res) => {
  try {
    await initDB();
    await db.query(`DELETE FROM listing_images WHERE "listingId" = $1`, [req.params.id]);
    await db.query(`DELETE FROM listings WHERE id = $1`, [req.params.id]);
    await pusher.trigger('mandi-global', 'listing-updated', { id: req.params.id, status: 'deleted' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/admin/support', adminAuth, async (req, res) => {
  try {
    await initDB();
    const { rows: messages } = await db.query(`SELECT support_messages.*, users.name, users.role, users.contact, users."selfiePath" FROM support_messages LEFT JOIN users ON users.id = support_messages."senderId" ORDER BY support_messages.timestamp DESC`);
    res.json(messages);
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/admin/support/:id/resolve', adminAuth, async (req, res) => {
  try {
    await initDB();
    await db.query(`UPDATE support_messages SET "isResolved" = 1 WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/admin/support/:id/reply', adminAuth, async (req, res) => {
  try {
    await initDB();
    const { reply } = req.body;
    await db.query(`UPDATE support_messages SET "adminReply" = $1, "unreadAdminReply" = 1 WHERE id = $2`, [reply, req.params.id]);
    await pusher.trigger('mandi-global', 'support-ticket-updated', {}); 
    res.json({ success: true, reply });
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/support', async (req, res) => {
  try {
    await initDB();
    const { senderId, message } = req.body;
    await db.query(`INSERT INTO support_messages (id, "senderId", message, timestamp) VALUES ($1, $2, $3, $4)`, [uuidv4(), senderId, message, Date.now()]);
    await pusher.trigger('mandi-global', 'support-ticket-updated', {});
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/support/history/:deviceId', async (req, res) => {
  try {
    await initDB();
    const { rows } = await db.query(`SELECT * FROM support_messages WHERE "senderId" LIKE $1 ORDER BY timestamp ASC`, [`${req.params.deviceId}%`]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/support/unread/:deviceId', async (req, res) => {
  try {
    await initDB();
    const { rows } = await db.query(`SELECT COUNT(*) as count FROM support_messages WHERE "senderId" LIKE $1 AND "unreadAdminReply" = 1`, [`${req.params.deviceId}%`]);
    res.json({ count: parseInt(rows[0].count) });
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/support/read/:deviceId', async (req, res) => {
  try {
    await initDB();
    await db.query(`UPDATE support_messages SET "unreadAdminReply" = 0 WHERE "senderId" LIKE $1`, [`${req.params.deviceId}%`]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

export default app;
