const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Read .env.local file to get MONGODB_URI
const envPath = path.join(__dirname, '../.env.local');
let mongodbUri = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^MONGODB_URI=(.*)$/m);
  if (match && match[1]) {
    mongodbUri = match[1].trim().replace(/['"]/g, '');
  }
}

if (!mongodbUri) {
  mongodbUri = 'mongodb+srv://inflationengineering:xI2QuBaFZsYQ5vRD@cluster0.e5n1hnl.mongodb.net/inflationengineering';
}

console.log('Connecting to MongoDB...');

const FAQSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const FAQ = mongoose.models.FAQ || mongoose.model('FAQ', FAQSchema);

const faqs = [
  {
    question: 'What kinds of electronics tools and smart devices do you offer?',
    answer: 'We specialize in professional electronics tools (soldering stations, multimeters, diagnostic gear), smart home devices (smart plugs, smart switches, smart lighting systems), and premium wearable tech.',
    order: 1,
    isActive: true,
  },
  {
    question: 'Are your smart plugs and smart lights compatible with Google Assistant and Alexa?',
    answer: 'Yes! Most of our smart plugs, power devices, and intelligent light systems are fully compatible with Google Home, Amazon Alexa, and iOS/Android smart home mobile applications.',
    order: 2,
    isActive: true,
  },
  {
    question: 'Do your electronics tools and diagnostic equipment come with a warranty?',
    answer: 'Yes, all of our premium electronics diagnostic equipment, smart home systems, and soldering gear come with a standard manufacturer\'s warranty ranging from 6 to 12 months. Please refer to the specific product details.',
    order: 3,
    isActive: true,
  },
  {
    question: 'Do you deliver all over Bangladesh, and what are the charges?',
    answer: 'Yes, we deliver nationwide. Inside Dhaka, delivery takes 24 to 48 hours, and outside Dhaka, it takes 3 to 5 business days. Delivery charges are ৳60 inside Dhaka and ৳120 outside Dhaka, with free delivery on orders above ৳1500.',
    order: 4,
    isActive: true,
  },
  {
    question: 'What is the return policy for tools and smart home devices?',
    answer: 'We offer a 7-day return policy for unused, unopened products in their original packaging. If you encounter any technical issues or manufacturing defects, please contact our support team immediately for a replacement under warranty.',
    order: 5,
    isActive: true,
  }
];

async function seed() {
  try {
    try {
      await mongoose.connect(mongodbUri);
    } catch (connErr) {
      console.log('SRV connection failed, trying direct connection fallback...');
      const directUri = 'mongodb://inflationengineering:xI2QuBaFZsYQ5vRD@ac-jrowhop-shard-00-00.e5n1hnl.mongodb.net:27017,ac-jrowhop-shard-00-01.e5n1hnl.mongodb.net:27017,ac-jrowhop-shard-00-02.e5n1hnl.mongodb.net:27017/inflationengineering?ssl=true&authSource=admin';
      await mongoose.connect(directUri);
    }
    console.log('Connected to MongoDB successfully.');

    // Clear existing FAQs
    const deleteResult = await FAQ.deleteMany({});
    console.log(`Cleared ${deleteResult.deletedCount} existing FAQs.`);

    // Insert new FAQs
    const insertResult = await FAQ.insertMany(faqs);
    console.log(`Seeded ${insertResult.length} FAQs successfully:`);
    insertResult.forEach((f, i) => {
      console.log(`[FAQ ${i + 1}] Question: "${f.question}"`);
    });

  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

seed();
