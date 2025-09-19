// db.js
const mongoose = require('mongoose');
require('dotenv').config({ quiet: true });

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("Connected to MongoDB"))
.catch((err) => console.error("MongoDB connection error:", err));

// User schema
const userSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 254
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30
  },
  payees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, {
  timestamps: true
});

// Account schema 
const accountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  timestamps: true
});

// Transaction schema 
const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  description: { type: String, default: "" },
  isReceived: { type: Boolean, required: true },
  date: { type: Date, default: Date.now },
  category: { type: String }
}, {
  timestamps: true
});

// Budget schema 
const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true },
  limit: { type: Number, required: true },
  spent: { type: Number, default: 0 },
  month: { type: Number },
  year: { type: Number } 
}, {
  timestamps: true
});

// Goal schema
const goalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  target: { type: Number, required: true },
  progress: { type: Number, default: 0 }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);
const Account = mongoose.model('Account', accountSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Budget = mongoose.model('Budget', budgetSchema);
const Goal = mongoose.model('Goal', goalSchema);

module.exports = {
  User,
  Account,
  Transaction,
  Budget,
  Goal
};