(function () {
  // Catalog — add new SKUs here. `line` drives Shop filters automatically.
  const MAKHANA_CLAIMS = ['Naturally gluten free', 'Protein packed', 'Rich in fibre', 'Jain friendly'];
  const products = [
    { id: 'peri', line: 'Roasted Makhana', name: 'Peri Peri', size: 'Jar', price: 299, tag: 'Bestseller', tint: '#F8D3C6',
      desc: 'Roasted makhana tossed in a smoky, tangy peri peri blend. Chilli heat that lifts heavy.',
      notes: ['Smoky', 'Tangy', 'Medium heat'], claims: MAKHANA_CLAIMS,
      images: ['assets/peri-drop.jpg', 'assets/peri-flatlay.jpg'], mascot: 'assets/mc-lifter.png', mascotName: 'The Lifter', mascotBg: '#EE2B29' },
    { id: 'cheese', line: 'Roasted Makhana', name: 'Cheese', size: 'Jar', price: 299, tag: 'Bestseller', tint: '#FCE6B4',
      desc: 'Golden, cheesy roasted makhana that disappears in one session. Effortlessly cool.',
      notes: ['Cheesy', 'Savoury', 'Mild'], claims: MAKHANA_CLAIMS,
      images: ['assets/cheese-drop.jpg', 'assets/cheese-table.jpg'], mascot: 'assets/mc-skater.png', mascotName: 'The Skater', mascotBg: '#FAA718' },
    { id: 'himalayan', line: 'Roasted Makhana', name: 'Himalayan Salt & Pepper', size: 'Jar', price: 299, tag: '', tint: '#F9D6DA',
      desc: 'Pink Himalayan salt and cracked black pepper. The classic combo that never misses.',
      notes: ['Salty', 'Peppery', 'Classic'], claims: MAKHANA_CLAIMS,
      images: ['assets/himalayan-reach.jpg', 'assets/himalayan-hand.jpg', 'assets/himalayan-window.jpg', 'assets/himalayan-yoga.jpg'], mascot: 'assets/mc-runner.png', mascotName: 'The Striker', mascotBg: '#F59AA4' },
    { id: 'pudina', line: 'Roasted Makhana', name: 'Pudina', size: 'Jar', price: 299, tag: 'New', tint: '#D6EBC8',
      desc: 'Cool mint with a sharp, tangy finish. Fresh enough to win every rally.',
      notes: ['Minty', 'Fresh', 'Tangy'], claims: MAKHANA_CLAIMS,
      images: ['assets/pudina-hands.jpg', 'assets/pudina-pop.jpg'], mascot: 'assets/mc-pickleball.png', mascotName: 'The Smasher', mascotBg: '#8FC579' },
    { id: 'classic', line: 'Ready to Roast', name: 'Makhana', size: '70g pouch', price: 149, tag: '', tint: '#DCE4C0',
      desc: 'Plain, premium makhana — popped lotus seeds, ready for you to roast and season your way at home.',
      notes: ['Plain', 'Versatile', 'Roast at home'], claims: ['Naturally gluten free', 'Protein packed', 'Rich in fibre', 'Everyday wellness'],
      images: ['assets/makhana-pond.jpg', 'assets/makhana-lotus.jpg', 'assets/pack.jpg'],
      ingredients: 'Makhana (Popped Lotus Seeds) (99%)',
      nutrition: [['Energy', '373 kcal'], ['Protein', '13.6 g'], ['Carbohydrate', '64.7 g'], ['Dietary fibre', '4.4 g'], ['Total fat', '6.3 g'], ['Added sugars', '0 g']] }
  ];
  const asset = (p) => { const r = window.__resources; const k = 'a-' + p.replace(/^.*\//, '').replace(/\.\w+$/, ''); return (r && r[k]) || p; };
  products.forEach(p => { const im = p.images, m = p.mascot;
    Object.defineProperty(p, 'images', { get: () => im.map(asset), enumerable: true });
    if (m) Object.defineProperty(p, 'mascot', { get: () => asset(m), enumerable: true }); });
  const info = {
    storage: 'Store in a cool, dry place. Reseal after opening to preserve freshness and crunch. Keep away from direct sunlight and moisture.',
    allergen: 'Packed in a facility that also processes peanuts, tree nuts and sesame seeds.'
  };
  const FREE_SHIP = 499, SHIP_FEE = 49, KEY = 'beej-cart';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const write = (c) => { localStorage.setItem(KEY, JSON.stringify(c)); window.dispatchEvent(new Event('beej-cart')); };
  const byId = (id) => products.find(p => p.id === id);
  const cart = {
    items: () => read().filter(i => byId(i.id)).map(i => ({ ...i, product: byId(i.id) })),
    add(id, qty = 1) { const c = read(); const f = c.find(i => i.id === id); f ? f.qty += qty : c.push({ id, qty }); write(c); },
    set(id, qty) { let c = read(); c = qty <= 0 ? c.filter(i => i.id !== id) : c.map(i => i.id === id ? { ...i, qty } : i); write(c); },
    clear() { write([]); },
    count: () => read().reduce((s, i) => s + i.qty, 0),
    subtotal: () => cart.items().reduce((s, i) => s + i.qty * i.product.price, 0),
    on(fn) { const h = () => fn(); window.addEventListener('beej-cart', h); window.addEventListener('storage', h); return () => { window.removeEventListener('beej-cart', h); window.removeEventListener('storage', h); }; }
  };
  const money = (n) => '₹' + n.toLocaleString('en-IN');
  const productUrl = (id) => 'Beej%20Product.dc.html?id=' + id;
  const params = () => { const m = location.hash.match(/^#\/\w+(\?[^#]*)?/); return new URLSearchParams(m ? (m[1] || '') : location.search); };
  window.BeejData = { asset, params, products, byId, info, cart, money, productUrl, FREE_SHIP, SHIP_FEE };
  window.dispatchEvent(new Event('beej-ready'));
})();
