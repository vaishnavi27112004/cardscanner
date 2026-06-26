// ════════════════════════════════════════════════════════════════
//  EXPO Lead Capture — Backend Server (Fixed Local Version)
//  Stack: Node.js + Express + MongoDB (Mongoose) + JWT Auth
// ════════════════════════════════════════════════════════════════
require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const cors     = require('cors');
const crypto   = require('crypto');
const nodemailer = require('nodemailer');

const app  = express();

// Read PORT from .env (default 5000 — change in .env if that port is busy on your PC)
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// ── Middleware (Fixed to allow Cross-Port Local traffic seamlessly) ──
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.options('*', cors()); // Handles browser pre-flight safety requests

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));  // serves index.html, login.html

// ── MongoDB Schemas ─────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expo_leads')
  .then(() => console.log('✅ Successfully connected to MongoDB Atlas!'))
  .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

// User Schema
const UserSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  company:    { type: String, trim: true, default: '' },
  password:   { type: String, required: true },
  role:       { type: String, enum: ['admin', 'user'], default: 'user' },
  resetToken: { type: String },
  resetExpires: { type: Date },
  createdAt:  { type: Date, default: Date.now },
  lastLogin:  { type: Date },
});

// Lead Schema
const LeadSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  firstName:    { type: String, required: true, trim: true },
  lastName:     { type: String, trim: true, default: '' },
  company:      { type: String, trim: true, default: '' },
  position:     { type: String, trim: true, default: '' },
  department:   { type: String, trim: true, default: '' },
  email:        { type: String, trim: true, default: '' },
  phone:        { type: String, trim: true, default: '' },
  whatsapp:     { type: String, trim: true, default: '' },
  website:      { type: String, trim: true, default: '' },
  quality:      { type: String, enum: ['hot', 'warm', 'cold'], required: true },
  interests:    [{ type: String }],
  followup:     { type: String, default: '' },
  followupDate: { type: String, default: '' },
  feedback:     { type: String, default: '' },
  notes:        { type: String, default: '' },
  rep:          { type: String, default: '' },
  event:        { type: String, default: '' },
  clientId:     { type: String, default: '' },
  ts:           { type: String, default: () => new Date().toISOString() },
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Lead = mongoose.model('Lead', LeadSchema);

// ── JWT Helper ──────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// ── Auth Middleware ─────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorised — please login' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Session expired — please login again' });
  }
}

// ── Email Helper ────────────────────────────────────────────────
function getMailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// ════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════════════════════════════

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, company, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });
    if (password.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters' });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: 'An account with this email already exists' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, company: company || '', password: hashed });
    user.lastLogin = new Date(); await user.save();

    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, company: user.company, role: user.role }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid email or password' });

    user.lastLogin = new Date(); await user.save();
    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, company: user.company, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const user = await User.findOne({ email });
    if (!user) return res.json({ message: 'If that email exists, a reset link was sent' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const mailer = getMailer();
    if (mailer) {
      const resetUrl = `http://localhost:${PORT}/reset-password.html?token=${token}`;
      await mailer.sendMail({
        from: process.env.SMTP_FROM || 'noreply@expo-leads.app',
        to: user.email,
        subject: 'EXPO Lead Capture – Password Reset',
        html: `<p>Hi ${user.name},</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      });
    }
    res.json({ message: 'If that email exists, a reset link was sent' });
  } catch (err) {
    console.error('Forgot pw error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token and password required' });
    const user = await User.findOne({ resetToken: token, resetExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: 'Reset link is invalid or has expired' });

    user.password = await bcrypt.hash(password, 12);
    user.resetToken = undefined;
    user.resetExpires = undefined;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -resetToken -resetExpires');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── LEADS ROUTES ────────────────────────────────────────────────
app.post('/api/leads', requireAuth, async (req, res) => {
  try {
    const body = req.body;
    const lead = await Lead.create({
      userId:       req.user.id,
      firstName:    body.firstName,
      lastName:     body.lastName   || '',
      company:      body.company    || '',
      position:     body.position   || '',
      department:   body.department || '',
      email:        body.email      || '',
      phone:        body.phone      || '',
      whatsapp:     body.whatsapp   || '',
      website:      body.website    || '',
      quality:      body.quality,
      interests:    body.interests  || [],
      followup:     body.followup   || '',
      followupDate: body.followupDate || '',
      feedback:     body.feedback   || '',
      notes:        body.notes      || '',
      rep:          body.rep        || '',
      event:        body.event      || '',
      clientId:     body.id         || '',
      ts:           body.ts         || new Date().toISOString(),
    });
    res.status(201).json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save lead' });
  }
});

app.get('/api/leads', requireAuth, async (req, res) => {
  try {
    const { quality, search, sort } = req.query;
    let filter = { userId: req.user.id };
    if (quality) filter.quality = quality;
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ firstName: re }, { lastName: re }, { company: re }, { email: re }];
    }
    const sortMap = { oldest: { ts: 1 }, name: { firstName: 1 }, newest: { ts: -1 } };
    const leads = await Lead.find(filter).sort(sortMap[sort] || sortMap.newest);
    res.json({ success: true, leads });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch leads' });
  }
});

app.get('/api/leads/stats', requireAuth, async (req, res) => {
  try {
    const counts = await Lead.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: '$quality', count: { $sum: 1 } } }
    ]);
    const stats = { hot: 0, warm: 0, cold: 0, total: 0 };
    counts.forEach(c => { stats[c._id] = c.count; stats.total += c.count; });
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 EXPO Lead Capture server running on http://localhost:${PORT}`);
});
// ── GET single lead ─────────────────────────────────────────────
app.get('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, userId: req.user.id });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch lead' });
  }
});

// ── UPDATE lead ─────────────────────────────────────────────────
app.put('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    const body = req.body;
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      {
        firstName:    body.firstName,
        lastName:     body.lastName    || '',
        company:      body.company     || '',
        position:     body.position    || '',
        department:   body.department  || '',
        email:        body.email       || '',
        phone:        body.phone       || '',
        whatsapp:     body.whatsapp    || '',
        website:      body.website     || '',
        quality:      body.quality,
        interests:    body.interests   || [],
        followup:     body.followup    || '',
        followupDate: body.followupDate || '',
        feedback:     body.feedback    || '',
        notes:        body.notes       || '',
        rep:          body.rep         || '',
        event:        body.event       || '',
      },
      { new: true, runValidators: true }
    );
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update lead' });
  }
});

// ── DELETE single lead ───────────────────────────────────────────
app.delete('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete lead' });
  }
});

// ── DELETE ALL leads for current user ───────────────────────────
app.delete('/api/leads', requireAuth, async (req, res) => {
  try {
    const result = await Lead.deleteMany({ userId: req.user.id });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete leads' });
  }
});
