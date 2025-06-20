// Import dependencies
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const User = require('./models/user');
const questions = require('./questions');
const multer = require('multer');

dotenv.config();

// Set storage destination and filename
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});

const fs = require('fs');

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const app = express();
const PORT = process.env.PORT || 5000;

const upload = multer({ storage: storage });

// Middleware
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

// JWT Auth Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No token.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    req.user = decoded;
    next();
  } catch {
    res.status(400).json({ error: 'Invalid token.' });
  }
}

// ROUTES START -----------------------------------------------------

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'auth.html'));
});

// Registration Route
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ name, email, password: hashedPassword });
  await user.save();

  res.json({ message: 'Registration successful' });
});

// Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, { expiresIn: '1h' });
  res.json({ message: 'Login successful', token });
});

// Dashboard Route
app.get('/dashboard', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ message: `Welcome, ${user.name}!`, userId: user._id, userName: user.name });
});

// Get Questions
app.get('/questions/:category', authMiddleware, (req, res) => {
  const category = req.params.category;

  if (!questions[category]) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  res.json({ questions: questions[category] });
});

// Save Results
app.post('/saveResult', authMiddleware, async (req, res) => {
  const { category, subField, score, timeTaken } = req.body;

  if (!category || !subField || score === undefined || timeTaken === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.selectedCategory = category;
  user.selectedSubField = subField;
  user.testResult = score;
  user.testTime = timeTaken;

  await user.save();
  res.json({ message: 'Result saved successfully' });
});

// Get User Profile
app.get('/profile', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    name: user.name,
    email: user.email,
    selectedCategory: user.selectedCategory,
    selectedSubField: user.selectedSubField,
    testResult: user.testResult,
    testTime: user.testTime,
    avatar: user.avatar
  });
});

// Get Tips
app.post('/tips', authMiddleware, async (req, res) => {
  const { category, subField, testResult } = req.body;

  if (!category || !subField || testResult === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const tips = [
      `Master ${subField}-specific tools and practice regularly.`,
      `Build a strong online portfolio for ${category}/${subField}.`,
      `Network with others in ${category} and join relevant communities.`,
      `Offer freelance services for ${subField}-based projects online.`,
      `Continue learning through courses and stay updated with ${category} trends.`
    ];

    res.json({ tips });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating tips.' });
  }
});

// Update Profile Route
app.post('/update-profile', authMiddleware, upload.single('avatar'), async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.name = name;
    user.email = email;

    if (req.file) {
      user.avatar = `/uploads/${req.file.filename}`;
    }

    await user.save();
    res.json({ message: 'Profile updated successfully', avatar: user.avatar });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating profile.' });
  }
});

// ===========================================================
// 👇 Catch-All Route Must Be LAST 👇
// ===========================================================
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' }); 
});

// ===========================================================
// Start Server
// ===========================================================
app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
