// routes/account.js
const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware');
const { Account, Transaction, User, Budget, Goal } = require('../db');
const router = express.Router();


// GET /account/balance
router.get("/balance", authMiddleware, async (req, res) => {
  try {
    let account = await Account.findOne({ userId: req.userId });
    if (!account) {
      // create default account if missing
      account = await Account.create({ userId: req.userId, balance: 0 });
    }
    res.json({ balance: account.balance });
  } catch (err) {
    console.error("Balance error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


// POST /account/transfer
router.post("/transfer", authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { amount, toUsername } = req.body;
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid amount" });
    }

    const senderAccount = await Account.findOne({ userId: req.userId }).session(session);
    if (!senderAccount || senderAccount.balance < Number(amount)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // find recipient user (userName stored lowercase)
    const recipientUser = await User.findOne({ userName: String(toUsername).toLowerCase() }).session(session);
    if (!recipientUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid recipient" });
    }

    const recipientAccount = await Account.findOne({ userId: recipientUser._id }).session(session);
    if (!recipientAccount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Recipient account not found" });
    }

    const senderUser = await User.findById(req.userId).session(session);

    // Update balances
    await Account.updateOne({ userId: req.userId }, { $inc: { balance: -Number(amount) } }).session(session);
    await Account.updateOne({ userId: recipientUser._id }, { $inc: { balance: Number(amount) } }).session(session);

    // Add recipient to sender's payees if not present
    await User.updateOne(
      { _id: req.userId, payees: { $ne: recipientUser._id } },
      { $push: { payees: recipientUser._id } }
    ).session(session);

    // Log both transactions in the same session
    const now = new Date();
    await Transaction.create(
      [
        {
          userId: req.userId,
          amount: Number(amount),
          description: `Money sent to ${recipientUser.firstName} ${recipientUser.lastName}`,
          isReceived: false,
          date: now,
          category: "transfer"
        },
        {
          userId: recipientUser._id,
          amount: Number(amount),
          description: `Money received from ${senderUser.firstName} ${senderUser.lastName}`,
          isReceived: true,
          date: now,
          category: "transfer"
        }
      ],
      { session, ordered: true }
    );

    await session.commitTransaction();
    session.endSession();
    res.json({ message: "Transfer successful" });
  } catch (err) {
    console.error("Transfer error:", err);
    try {
      await session.abortTransaction();
    } catch (e) {
      console.error("Abort failed:", e);
    }
    session.endSession();
    res.status(500).json({ message: "Internal server error" });
  }
});



// POST /account/transactions
router.post('/transactions', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { amount, description = "", isReceived = false, category = null } = req.body;
    const value = Number(amount);
    if (!value || isNaN(value)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid amount" });
    }

    const account = await Account.findOne({ userId: req.userId }).session(session);
    if (!account) {
      // create if missing
      await Account.create([{ userId: req.userId, balance: 0 }], { session });
    }

    const delta = isReceived ? value : -value;
    await Account.updateOne({ userId: req.userId }, { $inc: { balance: delta } }).session(session);

    await Transaction.create([{
      userId: req.userId,
      amount: value,
      description,
      isReceived,
      date: new Date(),
      category
    }], { session });

    // If category matches a budget, increment budget.spent
    if (category && !isReceived) {
      await require('../db').Budget.updateOne(
        { userId: req.userId, category: category },
        { $inc: { spent: value } }
      ).session(session);
    }
    else if (category && isReceived) {
      await require('../db').Goal.updateOne(
        { userId: req.userId, title: category },
        { $inc: { progress: value } }
      ).session(session);
    }

    await session.commitTransaction();
    session.endSession();
    res.json({ message: "Transaction added, account updated" });
  } catch (err) {
    console.error("Add transaction error:", err);
    try { await session.abortTransaction(); } catch(e){/*ignore*/ }
    session.endSession();
    res.status(500).json({ message: "Internal server error" });
  }
});



// GET /account/transactions
router.get('/transactions', authMiddleware, async(req,res) => {
  try {
    const userId = req.userId;
    const { limit = 50, page = 1, category, from, to } = req.query;
    const q = { userId };

    if (category) q.category = category;
    if (from || to) q.date = {};
    if (from) q.date.$gte = new Date(from);
    if (to) q.date.$lte = new Date(to);

    const transactions = await Transaction.find(q)
      .sort({ date: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    res.json({ transactions });
  } catch (err) {
    console.error("Get transactions error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


// GET /account/budgets
router.get('/budgets', authMiddleware, async (req, res) => {
  try {
    const budgets = await require('../db').Budget.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(budgets);
  } catch (err) {
    console.error("Get budgets error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


// POST /account/budgets
router.post('/budgets', authMiddleware, async (req, res) => {
  try {
    const { category, limit } = req.body;
    console.log("clear1");
    const date = new Date();
    const b = await require('../db').Budget.create({
      userId: req.userId,
      category,
      limit: Number(limit),
      spent: 0,
      month: date.getMonth() + 1 || null,
      year: date.getFullYear() || null
    });
    console.log("clear2");
    res.json(b);
    console.log("clear3");
  } catch (err) {
    console.error("Create budget error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /account/budgets/:id
router.delete('/budgets/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    await require('../db').Budget.deleteOne({ _id: id, userId: req.userId });
    res.json({ message: "Budget deleted" });
  } catch (err) {
    console.error("Delete budget error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


// GET /account/goals
router.get('/goals', authMiddleware, async (req, res) => {
  try {
    const goals = await require('../db').Goal.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) {
    console.error("Get goals error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


// POST /account/goals
router.post('/goals', authMiddleware, async (req, res) => {
  try {
    const { title, target } = req.body;
    const g = await require('../db').Goal.create({
      userId: req.userId,
      title,
      target: Number(target),
      progress: 0
    });
    res.json(g);
  } catch (err) {
    console.error("Create goal error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


// DELETE /account/goals/:id
router.delete('/goals/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    await require('../db').Goal.deleteOne({ _id: id, userId: req.userId });
    res.json({ message: "Goal deleted" });
  } catch (err) {
    console.error("Delete goal error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;