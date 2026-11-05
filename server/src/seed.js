import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { db, nowIso } from './db.js';
import { generateTableToken } from './utils/ids.js';

const menuSeed = [
  {
    name: 'Paneer Tikka',
    description: 'Charred cottage cheese, smoked chilli, mint chutney and pickled onion.',
    pricePaise: 32500,
    category: 'Starters',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 18,
  },
  {
    name: 'Crispy Corn',
    description: 'Golden sweetcorn tossed with curry leaf, chilli and a squeeze of lime.',
    pricePaise: 24500,
    category: 'Starters',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 12,
  },
  {
    name: 'Chicken 65',
    description: 'South Indian fried chicken with red chilli, yoghurt and curry leaves.',
    pricePaise: 34500,
    category: 'Starters',
    isVeg: 0,
    imageUrl: 'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 20,
  },
  {
    name: 'Tandoori Wings',
    description: 'Clay-oven chicken wings, hung curd marinade and burnt garlic mayo.',
    pricePaise: 36500,
    category: 'Starters',
    isVeg: 0,
    imageUrl: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 22,
  },
  {
    name: 'Dal Makhani',
    description: 'Slow-cooked black lentils, cultured butter and a whisper of smoke.',
    pricePaise: 29500,
    category: 'Mains',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 20,
  },
  {
    name: 'Paneer Butter Masala',
    description: 'Silky tomato-cashew gravy, paneer and fresh cream.',
    pricePaise: 37500,
    category: 'Mains',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 18,
  },
  {
    name: 'Butter Chicken',
    description: 'Tandoori chicken in a luxuriously slow-simmered makhani gravy.',
    pricePaise: 44500,
    category: 'Mains',
    isVeg: 0,
    imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 24,
  },
  {
    name: 'Veg Biryani',
    description: 'Fragrant basmati layered with seasonal vegetables and saffron.',
    pricePaise: 32500,
    category: 'Mains',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 26,
  },
  {
    name: 'Chicken Biryani',
    description: 'Hyderabadi-style biryani, tender chicken, fried onion and mirchi ka salan.',
    pricePaise: 42500,
    category: 'Mains',
    isVeg: 0,
    imageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 28,
  },
  {
    name: 'Garlic Naan',
    description: 'Tandoor-baked naan finished with garlic butter and coriander.',
    pricePaise: 9500,
    category: 'Breads & Rice',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 8,
  },
  {
    name: 'Laccha Paratha',
    description: 'Flaky whole-wheat paratha, brushed with ghee.',
    pricePaise: 9000,
    category: 'Breads & Rice',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1619096252214-ef06c45683e3?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 10,
  },
  {
    name: 'Jeera Rice',
    description: 'Basmati rice tempered with cumin and ghee.',
    pricePaise: 19500,
    category: 'Breads & Rice',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 12,
  },
  {
    name: 'Gulab Jamun',
    description: 'Warm milk dumplings in cardamom syrup, pistachio crumble.',
    pricePaise: 18500,
    category: 'Desserts',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 6,
  },
  {
    name: 'Rasmalai',
    description: 'Soft chenna discs in chilled saffron milk.',
    pricePaise: 19500,
    category: 'Desserts',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 5,
  },
  {
    name: 'Chocolate Brownie',
    description: 'Dark chocolate brownie, toasted walnut and vanilla cream.',
    pricePaise: 22500,
    category: 'Desserts',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 8,
  },
  {
    name: 'Masala Chai',
    description: 'Assam tea, ginger, cardamom and fresh milk.',
    pricePaise: 9500,
    category: 'Beverages',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 5,
  },
  {
    name: 'Fresh Lime Soda',
    description: 'Sparkling soda, lime and a choice of sweet or salted.',
    pricePaise: 14500,
    category: 'Beverages',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 4,
  },
  {
    name: 'Mango Lassi',
    description: 'Alphonso mango, thick yoghurt and a pinch of cardamom.',
    pricePaise: 16500,
    category: 'Beverages',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 5,
  },
  {
    name: 'Cold Coffee',
    description: 'Double-shot coffee blended with milk and vanilla ice cream.',
    pricePaise: 18500,
    category: 'Beverages',
    isVeg: 1,
    imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=900&q=80',
    prepMinutes: 5,
  },
];

export function seedDatabase({ silent = false } = {}) {
  if (config.isProduction) {
    throw new Error('Demo seeding is disabled in production.');
  }

  const timestamp = nowIso();
  const log = (...args) => {
    if (!silent) console.log(...args);
  };

  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount === 0) {
    const passwordHashAdmin = bcrypt.hashSync(config.seed.adminPassword, 12);
    const passwordHashStaff = bcrypt.hashSync(config.seed.staffPassword, 12);
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `);
    insertUser.run(
      'Restaurant Admin',
      config.seed.adminEmail,
      passwordHashAdmin,
      'admin',
      timestamp,
      timestamp,
    );
    insertUser.run(
      'Kitchen Captain',
      config.seed.staffEmail,
      passwordHashStaff,
      'staff',
      timestamp,
      timestamp,
    );
    log('[seed] Created demo admin and staff accounts.');
    log(`         Admin: ${config.seed.adminEmail} / ${config.seed.adminPassword}`);
    log(`         Staff: ${config.seed.staffEmail} / ${config.seed.staffPassword}`);
  }

  const menuCount = db.prepare('SELECT COUNT(*) AS count FROM menu_items').get().count;
  if (menuCount === 0) {
    const insertItem = db.prepare(`
      INSERT INTO menu_items
        (name, description, price_paise, category, is_veg, image_url, is_available,
         is_archived, prep_minutes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)
    `);
    for (const item of menuSeed) {
      insertItem.run(
        item.name,
        item.description,
        item.pricePaise,
        item.category,
        item.isVeg,
        item.imageUrl,
        item.prepMinutes,
        timestamp,
        timestamp,
      );
    }
    log(`[seed] Added ${menuSeed.length} demo menu items.`);
  }

  const tableCount = db.prepare('SELECT COUNT(*) AS count FROM restaurant_tables').get().count;
  if (tableCount === 0) {
    const insertTable = db.prepare(`
      INSERT INTO restaurant_tables
        (table_number, label, qr_token, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `);
    for (let tableNumber = 1; tableNumber <= 8; tableNumber += 1) {
      insertTable.run(
        tableNumber,
        tableNumber <= 4 ? 'Window table' : 'Dining room',
        generateTableToken(),
        timestamp,
        timestamp,
      );
    }
    log('[seed] Created 8 demo tables with unique QR tokens.');
  }

  if (!silent) {
    const tables = db
      .prepare('SELECT table_number, qr_token FROM restaurant_tables WHERE is_active = 1 ORDER BY table_number')
      .all();
    console.log('\n[seed] Demo table menu links (development only):');
    for (const table of tables) {
      console.log(`  Table ${table.table_number}: ${config.frontendPublicUrl}/t/${table.qr_token}`);
    }
    console.log('\n[seed] Done. Start with: npm run dev\n');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedDatabase();
}
