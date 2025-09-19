// routes/user.js
const express = require('express');
const router = express.Router();
const zod = require("zod");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Account } = require("../db");
const { authMiddleware } = require('../middleware');
require('dotenv').config({ quiet: true });
const JWT_SECRET = process.env.JWT_SECRET || "replace_this_secret_in_env";

// VALIDATORS
const signupBody = zod.object({
  userName: zod.string().email(),
  firstName: zod.string().min(1),
  lastName: zod.string().min(1),
  password: zod.string().min(6),
  s_balance: zod.number().optional()
});

const signinBody = zod.object({
  userName: zod.string().email(),
  password: zod.string().min(6)
});

const updateBody = zod.object({
  password: zod.string().optional(),
  firstName: zod.string().optional(),
  lastName: zod.string().optional()
});


// POST /user/signup
router.post("/signup", async (req, res) => {
  try {
    const parse = signupBody.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ message: "Incorrect inputs" });
    }
    const { userName, password, firstName, lastName, s_balance = 0 } = req.body;

    const existingUser = await User.findOne({ userName: userName.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already taken" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      userName: userName.toLowerCase(),
      password: hashed,
      firstName,
      lastName
    });

    await Account.create({
      userId: user._id,
      balance: Number(s_balance) || 0
    });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ message: "User created successfully", token, userId: user._id });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


// POST /user/signin
router.post("/signin", async (req, res) => {
  try {
    console.log(req.body);
    const parse = signinBody.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ message: "Incorrect inputs" });
    }
    console.log(req.body);
    const user = await User.findOne({ userName: req.body.userName.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    console.log("pkk here");
    const match = await bcrypt.compare(req.body.password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, userId: user._id });
  } catch (err) {
    console.error("Signin error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /user/  (update current user)
router.put("/", authMiddleware, async (req, res) => {
  try {
    const parse = updateBody.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ message: "Invalid update payload" });
    }

    const payload = { ...req.body };
    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
    }

    await User.updateOne({ _id: req.userId }, payload);
    res.json({ message: "Updated successfully" });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /user/bulk?filter=...
router.get("/bulk", async (req, res) => {
  try {
    const filter = req.query.filter || "";
    const users = await User.find({
      $or: [
        { firstName: { "$regex": filter, "$options": "i" } },
        { lastName: { "$regex": filter, "$options": "i" } }
      ]
    });

    res.json({
      user: users.map(user => ({
        userName: user.userName,
        firstName: user.firstName,
        lastName: user.lastName,
        _id: user._id
      }))
    });
  } catch (err) {
    console.error("Bulk users error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


// GET /user/contacts
router.get('/contacts', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('payees', 'userName firstName lastName');
    if (!user) return res.status(404).json({ message: "User not found" });

    const payeeIds = (user.payees || []).map(u => u._id);
    const accounts = await Account.find({ userId: { $in: payeeIds } });

    const contacts = (user.payees || []).map(payee => {
      const account = accounts.find(acc => acc.userId.equals(payee._id));
      return {
        userId: payee._id,
        userName: payee.userName,
        firstName: payee.firstName,
        lastName: payee.lastName,
        accountId: account ? account._id : null,
        lastAmount: null
      };
    });

    res.json(contacts);
  } catch (err) {
    console.error("Get contacts error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


// POST /user/contacts  (add by username)
router.post('/contacts', authMiddleware, async (req, res) => {
  try {
    const { userName } = req.body; // frontend sends userName
    if (!userName) return res.status(400).json({ message: "Missing userName" });

    const contactUser = await User.findOne({ userName: String(userName).toLowerCase() });
    if (!contactUser) return res.status(404).json({ message: "User not found" });

    // prevent adding self
    if (String(contactUser._id) === String(req.userId)) {
      return res.status(400).json({ message: "Cannot add yourself as contact" });
    }

    await User.updateOne({ _id: req.userId, payees: { $ne: contactUser._id } }, { $push: { payees: contactUser._id } });
    res.json({ message: "Contact added" });
  } catch (err) {
    console.error("Add contact error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


// DELETE /user/contacts/:id
router.delete('/contacts/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    await User.updateOne({ _id: req.userId }, { $pull: { payees: id } });
    res.json({ message: "Contact removed" });
  } catch (err) {
    console.error("Delete contact error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


// GET /user/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ name: `${user.firstName} ${user.lastName}`, email: user.userName });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.post("/changeps", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Both fields are required" });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // compare old password
    const bcrypt = require("bcryptjs");
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // hash new password
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;