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

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true },
});
const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  salePrice: { type: Number },
  purchasePrice: { type: Number },
  discountRate: { type: Number },
  sku: { type: String, required: true, unique: true },
  stock: { type: Number, required: true, default: 0 },
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  tags: [{ type: String }],
  images: [{ type: String }],
  attributes: [
    {
      key: { type: String },
      value: { type: String },
    },
  ],
  isFeatured: { type: Boolean, default: false },
  isNewArrival: { type: Boolean, default: false },
  isFlashSale: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },
  ratings: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
}, { timestamps: true });

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

const productsData = [
  // Category 1: Electronics Tools (5 Products)
  {
    name: 'Digital Soldering Station',
    slug: 'digital-soldering-station',
    description: 'Precision temperature-controlled digital soldering station with rapid heating and sleep mode.',
    price: 3200,
    salePrice: 2850,
    discountRate: 11,
    purchasePrice: 1800,
    stock: 45,
    sku: 'IE-TL-DSS01',
    categorySlug: 'electronics-tools',
    images: ['/assets/images/products/digital_soldering_station.webp'],
    tags: ['soldering station', 'soldering', 'electronics tools', 'precision'],
    attributes: [{ key: 'Power', value: '65W' }, { key: 'Temp Range', value: '200°C - 480°C' }],
    isFeatured: true,
    isNewArrival: true,
    isFlashSale: false
  },
  {
    name: 'Auto-Ranging Digital Multimeter',
    slug: 'auto-ranging-digital-multimeter',
    description: 'High-precision intelligent digital multimeter with large backlit LCD and NCV detector.',
    price: 1500,
    salePrice: 1350,
    discountRate: 10,
    purchasePrice: 850,
    stock: 60,
    sku: 'IE-TL-ADM02',
    categorySlug: 'electronics-tools',
    images: ['/assets/images/products/auto_ranging_digital_multimeter.webp'],
    tags: ['multimeter', 'tester', 'voltmeter', 'electronics tools'],
    attributes: [{ key: 'Display', value: '6000 Counts' }, { key: 'Safety Rating', value: 'CAT III 600V' }],
    isFeatured: true,
    isNewArrival: false,
    isFlashSale: true
  },
  {
    name: 'Precision Screwdriver Set 64-in-1',
    slug: 'precision-screwdriver-set-64-in-1',
    description: 'Professional magnetic driver kit for smartphones, laptops, and game consoles repair.',
    price: 950,
    purchasePrice: 500,
    stock: 120,
    sku: 'IE-TL-PSS03',
    categorySlug: 'electronics-tools',
    images: ['/assets/images/products/precision_screwdriver_set_64_in_1.webp'],
    tags: ['screwdriver set', 'repair kit', 'tools', 'magnetic bits'],
    attributes: [{ key: 'Bits Count', value: '64 Bits' }, { key: 'Material', value: 'S2 Steel' }],
    isFeatured: false,
    isNewArrival: true,
    isFlashSale: true
  },
  {
    name: 'Digital Storage Oscilloscope',
    slug: 'digital-storage-oscilloscope',
    description: 'Dual channel handheld digital oscilloscope with 100MHz bandwidth and high-resolution screen.',
    price: 24500,
    purchasePrice: 15000,
    stock: 15,
    sku: 'IE-TL-DSO04',
    categorySlug: 'electronics-tools',
    images: ['/assets/images/products/digital_storage_oscilloscope.webp'],
    tags: ['oscilloscope', 'measuring tools', 'lab gear', 'diagnostics'],
    attributes: [{ key: 'Bandwidth', value: '100MHz' }, { key: 'Channels', value: '2 Channels' }],
    isFeatured: true,
    isNewArrival: false,
    isFlashSale: false
  },
  {
    name: 'Anti-Static ESD Repair Mat',
    slug: 'anti-static-esd-repair-mat',
    description: 'Heat-resistant silicone magnetic workbench mat for soldering and electronics work.',
    price: 650,
    salePrice: 550,
    discountRate: 15,
    purchasePrice: 320,
    stock: 90,
    sku: 'IE-TL-ESM05',
    categorySlug: 'electronics-tools',
    images: ['/assets/images/products/anti_static_esd_repair_mat.webp'],
    tags: ['esd mat', 'soldering mat', 'silicone mat', 'electronics tools'],
    attributes: [{ key: 'Size', value: '45x30 cm' }, { key: 'Heat Resistance', value: 'Up to 500°C' }],
    isFeatured: false,
    isNewArrival: false,
    isFlashSale: true
  },

  // Category 2: Smart Wearables (5 Products)
  {
    name: 'Amoled Smart Watch Pro',
    slug: 'amoled-smart-watch-pro',
    description: 'Premium smartwatch with AMOLED display, real-time heart rate monitor, SPO2, and GPS.',
    price: 4500,
    salePrice: 3890,
    discountRate: 14,
    purchasePrice: 2400,
    stock: 50,
    sku: 'IE-WR-ASW01',
    categorySlug: 'smart-wearables',
    images: ['/assets/images/products/amoled_smart_watch_pro.webp'],
    tags: ['smart watch', 'amoled', 'wearables', 'fitness tracker'],
    attributes: [{ key: 'Screen Size', value: '1.43 inch' }, { key: 'Battery Life', value: 'Up to 7 Days' }],
    isFeatured: true,
    isNewArrival: true,
    isFlashSale: false
  },
  {
    name: 'Smart Health Fitness Band',
    slug: 'smart-health-fitness-band',
    description: 'Ultra-lightweight activity tracker with sleep monitoring, step counter, and IP68 waterproof rating.',
    price: 1800,
    salePrice: 1550,
    discountRate: 14,
    purchasePrice: 1000,
    stock: 80,
    sku: 'IE-WR-SHB02',
    categorySlug: 'smart-wearables',
    images: ['/assets/images/products/smart_health_fitness_band.webp'],
    tags: ['fitness band', 'tracker', 'wearables', 'health'],
    attributes: [{ key: 'Waterproof', value: 'IP68' }, { key: 'Sensor', value: 'Heart Rate & Sleep' }],
    isFeatured: false,
    isNewArrival: true,
    isFlashSale: true
  },
  {
    name: 'Titanium Smart Ring V2',
    slug: 'titanium-smart-ring-v2',
    description: 'Minimalist titanium smart ring featuring advanced temperature tracking, sleep analysis, and touchless control.',
    price: 7500,
    purchasePrice: 4200,
    stock: 25,
    sku: 'IE-WR-TSR03',
    categorySlug: 'smart-wearables',
    images: ['/assets/images/products/titanium_smart_ring_v2.webp'],
    tags: ['smart ring', 'titanium', 'wearables', 'health tracker'],
    attributes: [{ key: 'Material', value: 'Titanium' }, { key: 'Connectivity', value: 'Bluetooth 5.0' }],
    isFeatured: true,
    isNewArrival: false,
    isFlashSale: false
  },
  {
    name: 'Active Noise Cancelling Smart Earbuds',
    slug: 'active-noise-cancelling-smart-earbuds',
    description: 'True wireless smart earbuds with hybrid active noise cancellation, custom EQ, and long battery life.',
    price: 3200,
    purchasePrice: 1700,
    stock: 75,
    sku: 'IE-WR-ANC04',
    categorySlug: 'smart-wearables',
    images: ['/assets/images/products/active_noise_cancelling_smart_earbuds.webp'],
    tags: ['earbuds', 'anc', 'wireless audio', 'wearables'],
    attributes: [{ key: 'ANC Depth', value: '35dB' }, { key: 'Playtime', value: 'Up to 30 Hours' }],
    isFeatured: false,
    isNewArrival: false,
    isFlashSale: true
  },
  {
    name: 'Smart Bluetooth Audio Glasses',
    slug: 'smart-bluetooth-audio-glasses',
    description: 'Stylish blue-light filtering smart glasses with open-ear audio speakers and built-in microphone.',
    price: 4800,
    salePrice: 4200,
    discountRate: 13,
    purchasePrice: 2600,
    stock: 30,
    sku: 'IE-WR-BAG05',
    categorySlug: 'smart-wearables',
    images: ['/assets/images/products/smart_bluetooth_audio_glasses.webp'],
    tags: ['smart glasses', 'audio glasses', 'bluetooth', 'wearables'],
    attributes: [{ key: 'Lens Type', value: 'Blue Light Filter' }, { key: 'Audio', value: 'Dual Speakers' }],
    isFeatured: false,
    isNewArrival: false,
    isFlashSale: true
  },

  // Category 3: Smart Lighting (5 Products)
  {
    name: 'RGBIC Smart LED Strip Light',
    slug: 'rgbic-smart-led-strip-light',
    description: '5-meter smart Wi-Fi LED strip light with segment control, music sync, and app integration.',
    price: 1200,
    salePrice: 990,
    discountRate: 18,
    purchasePrice: 600,
    stock: 150,
    sku: 'IE-LT-RGB01',
    categorySlug: 'smart-lighting',
    images: ['/assets/images/products/rgbic_smart_led_strip_light.webp'],
    tags: ['led strip', 'rgbic', 'smart lighting', 'decor'],
    attributes: [{ key: 'Length', value: '5 Meters' }, { key: 'Control', value: 'App & Voice' }],
    isFeatured: true,
    isNewArrival: true,
    isFlashSale: false
  },
  {
    name: 'Smart Wi-Fi LED Bulb E27',
    slug: 'smart-wifi-led-bulb-e27',
    description: 'Dimmable multi-color RGBCW smart bulb compatible with Alexa and Google Assistant.',
    price: 750,
    purchasePrice: 400,
    stock: 200,
    sku: 'IE-LT-SWB02',
    categorySlug: 'smart-lighting',
    images: ['/assets/images/products/smart_wifi_led_bulb_e27.webp'],
    tags: ['smart bulb', 'led bulb', 'e27', 'smart lighting'],
    attributes: [{ key: 'Base Type', value: 'E27' }, { key: 'Power', value: '9W' }],
    isFeatured: false,
    isNewArrival: false,
    isFlashSale: true
  },
  {
    name: 'Modern RGB Desk Lamp',
    slug: 'modern-rgb-desk-lamp',
    description: 'Ambient smart table lamp with customizable touch controls, millions of colors, and dynamic scenes.',
    price: 2500,
    purchasePrice: 1300,
    stock: 40,
    sku: 'IE-LT-RDL03',
    categorySlug: 'smart-lighting',
    images: ['/assets/images/products/modern_rgb_desk_lamp.webp'],
    tags: ['desk lamp', 'rgb lamp', 'smart lighting', 'ambient'],
    attributes: [{ key: 'Color Modes', value: '16 Million' }, { key: 'Input', value: 'USB-C' }],
    isFeatured: true,
    isNewArrival: false,
    isFlashSale: false
  },
  {
    name: 'Smart Motion Sensor Night Light',
    slug: 'smart-motion-sensor-night-light',
    description: 'Wireless magnetic under-cabinet rechargeable LED night light with intelligent motion sensing.',
    price: 450,
    salePrice: 380,
    discountRate: 16,
    purchasePrice: 220,
    stock: 180,
    sku: 'IE-LT-MSN04',
    categorySlug: 'smart-lighting',
    images: ['/assets/images/products/smart_motion_sensor_night_light.webp'],
    tags: ['night light', 'motion sensor', 'magnetic light', 'smart lighting'],
    attributes: [{ key: 'Battery', value: '1200mAh USB' }, { key: 'Sensing Angle', value: '120 degrees' }],
    isFeatured: false,
    isNewArrival: true,
    isFlashSale: false
  },
  {
    name: 'Smart Outdoor Floodlight',
    slug: 'smart-outdoor-floodlight',
    description: 'Weatherproof smart RGB floodlight for yard decoration, security lighting, and scheduling.',
    price: 3500,
    purchasePrice: 1900,
    stock: 35,
    sku: 'IE-LT-SOF05',
    categorySlug: 'smart-lighting',
    images: ['/assets/images/products/smart_outdoor_floodlight.webp'],
    tags: ['floodlight', 'outdoor light', 'smart lighting', 'waterproof'],
    attributes: [{ key: 'Waterproof Level', value: 'IP66' }, { key: 'Power', value: '50W' }],
    isFeatured: false,
    isNewArrival: true,
    isFlashSale: false
  },

  // Category 4: Plug & Power Devices (5 Products)
  {
    name: 'Smart Wi-Fi Wall Plug',
    slug: 'smart-wifi-wall-plug',
    description: 'Compact 16A smart plug with energy monitoring and timer settings via smartphone app.',
    price: 950,
    salePrice: 790,
    discountRate: 17,
    purchasePrice: 480,
    stock: 140,
    sku: 'IE-PW-SWP01',
    categorySlug: 'plug-power-devices',
    images: ['/assets/images/products/smart_wifi_wall_plug.webp'],
    tags: ['smart plug', 'wifi plug', 'energy monitor', 'power devices'],
    attributes: [{ key: 'Max Current', value: '16A' }, { key: 'Compatibility', value: 'Google & Alexa' }],
    isFeatured: true,
    isNewArrival: true,
    isFlashSale: false
  },
  {
    name: 'Smart Power Strip 4-Outlet',
    slug: 'smart-power-strip-4-outlet',
    description: 'Wi-Fi smart surge protector power strip with 4 individually controlled outlets and 4 USB ports.',
    price: 2400,
    salePrice: 2050,
    discountRate: 15,
    purchasePrice: 1250,
    stock: 65,
    sku: 'IE-PW-SPS02',
    categorySlug: 'plug-power-devices',
    images: ['/assets/images/products/smart_power_strip_4_outlet.webp'],
    tags: ['power strip', 'surge protector', 'smart plug', 'power devices'],
    attributes: [{ key: 'Cord Length', value: '1.8 Meters' }, { key: 'USB Output', value: '5V/3.1A Max' }],
    isFeatured: false,
    isNewArrival: true,
    isFlashSale: true
  },
  {
    name: 'Smart Wi-Fi Light Switch',
    slug: 'smart-wifi-light-switch',
    description: 'In-wall smart light switch panel with touch control button and status LED indicator.',
    price: 1350,
    purchasePrice: 700,
    stock: 90,
    sku: 'IE-PW-SWS03',
    categorySlug: 'plug-power-devices',
    images: ['/assets/images/products/smart_wifi_light_switch.webp'],
    tags: ['smart switch', 'wall switch', 'wifi switch', 'power devices'],
    attributes: [{ key: 'Type', value: '1-Gang Touch' }, { key: 'Neutral Wire', value: 'Required' }],
    isFeatured: false,
    isNewArrival: false,
    isFlashSale: true
  },
  {
    name: 'Smart USB Wall Charger',
    slug: 'smart-usb-wall-charger',
    description: 'Multi-port high-speed USB wall charger with automatic current sensing and short-circuit protection.',
    price: 850,
    purchasePrice: 420,
    stock: 110,
    sku: 'IE-PW-UWC04',
    categorySlug: 'plug-power-devices',
    images: ['/assets/images/products/smart_usb_wall_charger.webp'],
    tags: ['usb charger', 'wall charger', 'fast charging', 'power devices'],
    attributes: [{ key: 'Ports', value: '4x USB-A' }, { key: 'Total Power', value: '24W Max' }],
    isFeatured: false,
    isNewArrival: false,
    isFlashSale: false
  },
  {
    name: 'Universal Smart Travel Adapter',
    slug: 'universal-smart-travel-adapter',
    description: 'All-in-one international travel adapter with built-in smart fuse and multiple fast-charging USB ports.',
    price: 1650,
    purchasePrice: 850,
    stock: 85,
    sku: 'IE-PW-UTA05',
    categorySlug: 'plug-power-devices',
    images: ['/assets/images/products/universal_smart_travel_adapter.webp'],
    tags: ['travel adapter', 'universal adapter', 'charging', 'power devices'],
    attributes: [{ key: 'Fuse', value: 'Auto-Resetting' }, { key: 'USB-C Output', value: '20W PD' }],
    isFeatured: false,
    isNewArrival: false,
    isFlashSale: false
  },

  // Category 5: Electronic Components (5 Products)
  {
    name: 'Microcontroller Development Board',
    slug: 'microcontroller-development-board',
    description: 'Versatile development board with USB interface and rich pins, perfect for DIY electronics and learning coding.',
    price: 650,
    purchasePrice: 350,
    stock: 250,
    sku: 'IE-CP-MDB01',
    categorySlug: 'electronic-components',
    images: ['/assets/images/products/microcontroller_development_board.webp'],
    tags: ['microcontroller', 'development board', 'diy', 'components'],
    attributes: [{ key: 'Chip', value: 'ATmega328P' }, { key: 'Voltage', value: '5V' }],
    isFeatured: true,
    isNewArrival: true,
    isFlashSale: false
  },
  {
    name: 'Solderless Breadboard Kit',
    slug: 'solderless-breadboard-kit',
    description: 'Standard 830-point solderless breadboard with jumper wires and power supply module.',
    price: 450,
    purchasePrice: 220,
    stock: 150,
    sku: 'IE-CP-SBK02',
    categorySlug: 'electronic-components',
    images: ['/assets/images/products/solderless_breadboard_kit.webp'],
    tags: ['breadboard', 'prototyping', 'components', 'diy kit'],
    attributes: [{ key: 'Points', value: '830 Ties' }, { key: 'Included', value: 'Wires & Power Module' }],
    isFeatured: false,
    isNewArrival: false,
    isFlashSale: true
  },
  {
    name: 'Jumper Wire Assortment Set',
    slug: 'jumper-wire-assortment-set',
    description: 'Pack of 120 male-to-male, male-to-female, and female-to-female flexible breadboard wires.',
    price: 250,
    purchasePrice: 100,
    stock: 300,
    sku: 'IE-CP-JWA03',
    categorySlug: 'electronic-components',
    images: ['/assets/images/products/jumper_wire_assortment_set.webp'],
    tags: ['jumper wires', 'cables', 'components', 'breadboard'],
    attributes: [{ key: 'Quantity', value: '120 Pieces' }, { key: 'Length', value: '20 cm' }],
    isFeatured: false,
    isNewArrival: false,
    isFlashSale: false
  },
  {
    name: 'Electronics Component Starter Pack',
    slug: 'electronics-component-starter-pack',
    description: 'Essential assortment of LEDs, resistors, capacitors, transistors, and diodes for hobby projects.',
    price: 850,
    purchasePrice: 450,
    stock: 100,
    sku: 'IE-CP-CSP04',
    categorySlug: 'electronic-components',
    images: ['/assets/images/products/electronics_component_starter_pack.webp'],
    tags: ['starter pack', 'leds', 'resistors', 'components', 'diy'],
    attributes: [{ key: 'Total Pieces', value: '400+ Units' }, { key: 'Storage', value: 'Plastic Case' }],
    isFeatured: true,
    isNewArrival: false,
    isFlashSale: false
  },
  {
    name: 'Sensor Module Pack 37-in-1',
    slug: 'sensor-module-pack-37-in-1',
    description: 'Ultimate sensor module kit including temperature, motion, distance, and sound sensors.',
    price: 1850,
    purchasePrice: 1100,
    stock: 40,
    sku: 'IE-CP-SMP05',
    categorySlug: 'electronic-components',
    images: ['/assets/images/products/sensor_module_pack_37_in_1.webp'],
    tags: ['sensors', 'modules', '37-in-1', 'components', 'diy'],
    attributes: [{ key: 'Modules Count', value: '37 Sensors' }, { key: 'Case', value: 'Organized Organizer' }],
    isFeatured: false,
    isNewArrival: false,
    isFlashSale: false
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

    // Clear existing products
    const deleteResult = await Product.deleteMany({});
    console.log(`Cleared ${deleteResult.deletedCount} existing products.`);

    // Query all categories
    const categoriesList = await Category.find({});
    console.log(`Fetched ${categoriesList.length} categories from DB.`);

    const categoryMap = {};
    categoriesList.forEach(c => {
      categoryMap[c.slug] = c._id;
    });

    // Prepare products with proper Category ObjectIds
    const finalProducts = productsData.map(p => {
      const categoryId = categoryMap[p.categorySlug];
      if (!categoryId) {
        throw new Error(`Category with slug "${p.categorySlug}" not found in DB! Seed categories first.`);
      }
      const pCopy = { ...p };
      pCopy.categories = [categoryId];
      delete pCopy.categorySlug;
      return pCopy;
    });

    // Insert new products
    const insertResult = await Product.insertMany(finalProducts);
    console.log(`Seeded ${insertResult.length} products successfully:`);
    insertResult.forEach((prod, i) => {
      console.log(`[Product ${i + 1}] Name: "${prod.name}", SKU: "${prod.sku}"`);
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
