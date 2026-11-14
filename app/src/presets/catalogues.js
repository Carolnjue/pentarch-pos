// Demo catalogues per business type. KES prices, Kenya 2026.
// Category: [name, icon, costRatio, items]. Item: [name, priceKES, opts?]
// opts: c cost KES · t tax code (default B) · u unit · w weighed (sold per kg, gets PLU) · s service (min) · ns non-stock
//       uom [[name, factor, priceKES]] · ws [wholesalePriceKES, minQty] · b batches+expiry · sr serial/IMEI · v {size:[], colour:[]}
//       f favourite · st target stock · lo make low · kit station · mods [group ids] · rec [[itemName, qty]] · n notes
const DUKA = [
  ['Dairy & bread', 'droplet', 0.85, [
    ['Brookside Milk 500ml', 65, { t: 'A', f: 1, st: 60 }], ['Brookside Milk 250ml', 35, { t: 'A' }], ['Tuzo Milk 500ml', 63, { t: 'A' }],
    ['KCC Mala 500ml', 80, { t: 'A' }], ['Supa Loaf White Bread 400g', 65, { t: 'A', f: 1, st: 40 }], ['Festive Brown Bread 400g', 70, { t: 'A' }],
    ['Blue Band 250g', 140], ['Eggs (each)', 15, { t: 'A', uom: [['Tray (30)', 30, 420]], f: 1, st: 180 }]]],
  ['Flour & cereals', 'package', 0.88, [
    ['Jogoo Maize Flour 2kg', 165, { t: 'A', f: 1, st: 50 }], ['Soko Maize Flour 2kg', 155, { t: 'A' }], ['Pembe Maize Flour 2kg', 160, { t: 'A' }],
    ['Exe Home Baking Flour 2kg', 195, { t: 'A' }], ['Ajab Home Baking Flour 2kg', 190, { t: 'A' }], ['Kabras Sugar 1kg', 185, { f: 1, st: 40 }],
    ['Mumias Sugar 2kg', 360], ['Pishori Rice 1kg', 220, { t: 'A' }], ['Daawat Basmati Rice 1kg', 280]]],
  ['Cooking & spices', 'flame', 0.86, [
    ['Kimbo 1kg', 430, { f: 1 }], ['Kimbo 500g', 225], ['Elianto Corn Oil 1L', 390], ['Fresh Fri 1L', 380], ['Royco Mchuzi Mix 200g', 115],
    ['Royco Beef Cubes (12)', 60], ['Kensalt 1kg', 45, { t: 'A' }], ['Ketepa Pride Tea 100g', 95], ['Kericho Gold Tea Bags (50)', 220], ['Nescafe Classic 50g', 330]]],
  ['Household', 'sparkle', 0.82, [
    ['Omo Washing Powder 1kg', 330], ['Ariel Washing Powder 500g', 210], ['Toss Washing Powder 1kg', 220], ['Menengai Bar Soap 800g', 180],
    ['Sunlight Washing Bar 800g', 175], ['Geisha Bathing Soap 90g', 45], ['Harpic Toilet Cleaner 500ml', 265], ['Jik Bleach 750ml', 165],
    ['Rosy Toilet Tissue (10)', 350], ['Kiwi Shoe Polish Black 50ml', 120], ['Matches (pack of 10)', 30], ['Candle (each)', 15],
    ['Colgate Toothpaste 140g', 210], ['Always Ultra Pads (8)', 110, { lo: 1 }]]],
  ['Drinks & snacks', 'coffee', 0.8, [
    ['Coca-Cola 500ml', 80, { f: 1 }], ['Fanta Orange 500ml', 80], ['Sprite 500ml', 80], ['Dasani Water 500ml', 50], ['Keringet Water 1L', 100],
    ['Minute Maid Mango 400ml', 80], ['Delmonte Juice 1L', 260], ['Nuvita Digestive Biscuits 200g', 75], ['Tropical Heat Crisps 80g', 70],
    ['Big G Bubblegum (each)', 5, { st: 300 }]]],
  ['Airtime', 'phone', 0.95, [
    ['Safaricom Airtime KES 100', 100, { t: 'D', ns: 1, f: 1 }], ['Safaricom Airtime KES 50', 50, { t: 'D', ns: 1 }], ['Safaricom Airtime KES 20', 20, { t: 'D', ns: 1 }],
    ['Airtel Airtime KES 100', 100, { t: 'D', ns: 1 }]]]
];

const MINIMART_EXTRA = [
  ['Fresh produce', 'leaf', 0.7, [
    ['Tomatoes (kg)', 120, { t: 'A', w: 1, st: 30 }], ['Onions red (kg)', 140, { t: 'A', w: 1 }], ['Potatoes (kg)', 80, { t: 'A', w: 1, st: 60 }],
    ['Bananas ripe (kg)', 100, { t: 'A', w: 1 }], ['Sukuma wiki (bunch)', 20, { t: 'A' }], ['Avocado (each)', 30, { t: 'A' }], ['Oranges (kg)', 160, { t: 'A', w: 1 }]]],
  ['Meat & frozen', 'scale', 0.78, [
    ['Kenchic Whole Chicken 1.2kg', 650], ['Farmers Choice Beef Sausages 500g', 420], ['Farmers Choice Smokies (10)', 330], ['Beef mince (kg)', 850, { t: 'A', w: 1 }]]],
  ['Personal care', 'smile', 0.8, [
    ['Nivea Body Lotion 400ml', 590], ['Vaseline Petroleum Jelly 250ml', 360], ['Dettol Soap 175g', 110], ['Gillette Blue II Razors (5)', 250], ['Rexona Roll-on 50ml', 280]]],
  ['Baby', 'gift', 0.84, [
    ['Huggies Dry Diapers Size 4 (42)', 1650], ['Cerelac Wheat 400g', 720], ['Johnson\'s Baby Oil 200ml', 450]]]
];

const HARDWARE = [
  ['Cement & aggregate', 'package', 0.9, [
    ['Bamburi Cement 50kg', 820, { ws: [790, 20], uom: [['Pallet (30)', 30, 23700]], f: 1, st: 200 }], ['Simba Cement 50kg', 760, { ws: [735, 20], f: 1, st: 150 }],
    ['Savannah Cement 50kg', 740, { ws: [715, 20] }], ['River sand (tonne)', 3500, { ns: 1 }], ['Ballast (tonne)', 3200, { ns: 1 }], ['Waterproof cement 25kg', 1650]]],
  ['Roofing & steel', 'layers', 0.86, [
    ['Iron sheet gauge 30 (3m)', 850, { f: 1, st: 120 }], ['Iron sheet gauge 28 (3m)', 1150], ['Box profile gauge 30 (3m)', 980], ['Ridge cap 2m', 650],
    ['Y12 steel bar (12m)', 1350, { ws: [1300, 50] }], ['Y10 steel bar (12m)', 950], ['Y8 steel bar (12m)', 640], ['BRC mesh A142 (roll)', 18500],
    ['Binding wire 25kg', 4600], ['Timber 2x4 (per ft)', 70, { st: 600 }], ['Plywood 18mm', 4200], ['Gypsum ceiling board', 980]]],
  ['Nails & fixings', 'hash', 0.75, [
    ['Wire nails 3" (kg)', 180, { u: 'kg', f: 1, st: 150 }], ['Wire nails 4" (kg)', 180, { u: 'kg' }], ['Roofing nails (kg)', 260, { u: 'kg' }],
    ['Concrete nails 2" (kg)', 320, { u: 'kg' }], ['Hinges 4" (pair)', 120], ['Padlock Solex 50mm', 1150], ['Door lock 3-lever', 1450]]],
  ['Paint', 'droplet', 0.8, [
    ['Crown Emulsion Brilliant White 4L', 2450, { f: 1 }], ['Crown Super Gloss 4L', 3200], ['Duracoat Emulsion 20L', 7800], ['Sadolin Gloss 1L', 980],
    ['Paint brush 3"', 220], ['Paint roller 9"', 450], ['Thinner 1L', 380], ['Wall putty 20kg', 1350, { lo: 1 }]]],
  ['Plumbing', 'droplet', 0.78, [
    ['PPR pipe 20mm (4m)', 380], ['PVC pipe 4" (6m)', 1650], ['Gate valve 1/2"', 650], ['PPR elbow 20mm', 30, { st: 300 }], ['Teflon tape', 40],
    ['Roto water tank 1000L', 12500, { st: 6 }], ['Kitchen sink tap', 1250]]],
  ['Electrical', 'zap', 0.78, [
    ['Twin & earth cable 2.5mm (100m)', 9500], ['Single socket MK', 450], ['LED bulb 9W', 150, { f: 1 }], ['Extension cable 4-way', 950], ['Circuit breaker 20A', 650]]],
  ['Tools', 'wrench', 0.72, [
    ['Claw hammer', 650], ['Tape measure 5m', 380], ['Hacksaw', 550], ['Jembe (hoe)', 650], ['Wheelbarrow', 5800, { st: 8 }], ['Spirit level 600mm', 750], ['Floor tiles 40x40 (box)', 1250]]]
];

const AGROVET = [
  ['Fertiliser', 'leaf', 0.9, [
    ['DAP fertiliser 50kg', 3800, { t: 'A', f: 1, st: 60 }], ['CAN fertiliser 50kg', 3300, { t: 'A', f: 1 }], ['NPK 23:23:0 50kg', 3600, { t: 'A' }],
    ['Urea 50kg', 3500, { t: 'A' }], ['DAP fertiliser 10kg', 820, { t: 'A' }], ['Easygro foliar feed 1L', 950]]],
  ['Seeds', 'sparkle', 0.82, [
    ['DK 8031 maize seed 2kg', 650, { t: 'A', b: 1, f: 1 }], ['H614 maize seed 2kg', 600, { t: 'A', b: 1 }], ['H6213 maize seed 2kg', 620, { t: 'A', b: 1 }],
    ['Sukuma wiki seed 50g', 120, { t: 'A', b: 1 }], ['Tomato Anna F1 10g', 1800, { t: 'A', b: 1 }], ['Onion Red Creole 50g', 450, { t: 'A', b: 1 }],
    ['Cabbage Gloria F1 10g', 950, { t: 'A', b: 1 }], ['Bean seed Rosecoco 2kg', 520, { t: 'A', b: 1 }]]],
  ['Animal feeds', 'package', 0.86, [
    ['Dairy meal 70kg', 2900, { t: 'A', f: 1, st: 40 }], ['Layers mash 70kg', 3600, { t: 'A' }], ['Chick mash 50kg', 3100, { t: 'A' }], ['Pig grower 70kg', 2800, { t: 'A' }],
    ['Maclick Super 2kg', 560, { b: 1 }], ['Mineral lick block 2kg', 350], ['Pedigree Adult dog food 3kg', 2100]]],
  ['Crop protection', 'shield', 0.78, [
    ['Duduthrin 100ml', 380, { b: 1, f: 1 }], ['Duduthrin 250ml', 820, { b: 1 }], ['Ridomil Gold 250g', 1150, { b: 1 }], ['Roundup herbicide 1L', 1050, { b: 1 }],
    ['Thunder OD 100ml', 420, { b: 1 }], ['Mancozeb 1kg', 750, { b: 1 }], ['Actellic Super dust 200g', 180, { b: 1 }]]],
  ['Veterinary', 'pill', 0.75, [
    ['Albendazole 10% 100ml', 350, { b: 1 }], ['Oxytetracycline 20% 100ml', 650, { b: 1 }], ['Terramycin eye ointment', 280, { b: 1 }],
    ['Triatix tick spray 100ml', 450, { b: 1, f: 1 }], ['Steladone 100ml', 520, { b: 1 }], ['Ivermectin 1% 50ml', 380, { b: 1, lo: 1 }], ['Newcastle vaccine (100 doses)', 300, { b: 1 }]]],
  ['Tools & equipment', 'wrench', 0.75, [
    ['Knapsack sprayer 16L', 3500, { st: 6 }], ['Panga', 450], ['Gumboots (pair)', 950], ['Watering can 10L', 650], ['Aluminium milk can 10L', 4500], ['Poultry feeder 6kg', 450], ['Poultry drinker 5L', 380]]]
];

const PHARMACY = [
  ['Pain & fever', 'pill', 0.72, [
    ['Panadol Advance 500mg (strip 12)', 80, { t: 'A', b: 1, f: 1, st: 120 }], ['Panadol Extra (strip 12)', 120, { t: 'A', b: 1, f: 1 }], ['Hedex (strip 10)', 60, { t: 'A', b: 1 }],
    ['Ibuprofen 400mg (strip 10)', 50, { t: 'A', b: 1 }], ['Diclofenac 50mg (strip 10)', 60, { t: 'A', b: 1 }], ['Calpol Paediatric 60ml', 450, { t: 'A', b: 1 }]]],
  ['Antibiotics', 'shield', 0.68, [
    ['Amoxil 500mg capsules (21)', 450, { t: 'A', b: 1, f: 1 }], ['Amoxicillin 500mg capsules (21)', 250, { t: 'A', b: 1 }], ['Augmentin 625mg (14)', 1450, { t: 'A', b: 1 }],
    ['Azithromycin 500mg (3)', 350, { t: 'A', b: 1 }], ['Ciprofloxacin 500mg (10)', 200, { t: 'A', b: 1 }], ['Metronidazole 400mg (strip 10)', 60, { t: 'A', b: 1 }], ['Flucloxacillin 250mg (20)', 300, { t: 'A', b: 1 }]]],
  ['Cough, cold & allergy', 'droplet', 0.7, [
    ['Benylin 4 Flu 100ml', 450, { t: 'A', b: 1 }], ['Coldcap (strip 10)', 120, { t: 'A', b: 1 }], ['Strepsils (16)', 380, { b: 1 }], ['Vicks VapoRub 25g', 220, { b: 1 }],
    ['Piriton 4mg (strip 10)', 40, { t: 'A', b: 1 }], ['Cetirizine 10mg (strip 10)', 50, { t: 'A', b: 1 }]]],
  ['Stomach', 'coffee', 0.7, [
    ['Gaviscon liquid 150ml', 650, { t: 'A', b: 1 }], ['ORS sachet', 30, { t: 'A', b: 1 }], ['Buscopan (strip 10)', 250, { t: 'A', b: 1 }], ['Imodium capsules (6)', 300, { t: 'A', b: 1 }], ['Eno sachet', 40, { b: 1 }]]],
  ['Malaria & chronic', 'pill', 0.7, [
    ['Coartem 80/480 (6)', 650, { t: 'A', b: 1 }], ['Duo-Cotecxin (9)', 450, { t: 'A', b: 1 }], ['Metformin 500mg (strip 10)', 100, { t: 'A', b: 1 }],
    ['Amlodipine 5mg (strip 10)', 150, { t: 'A', b: 1 }], ['Losartan 50mg (strip 10)', 250, { t: 'A', b: 1, lo: 1 }]]],
  ['Vitamins', 'sun', 0.7, [
    ['Vitamin C 1000mg effervescent (10)', 450, { b: 1 }], ['Seven Seas Multivitamin (30)', 1150, { b: 1 }], ['Ranferon syrup 200ml', 750, { t: 'A', b: 1 }],
    ['Folic acid 5mg (strip 10)', 50, { t: 'A', b: 1 }], ['Zinc 20mg (strip 10)', 100, { t: 'A', b: 1 }]]],
  ['First aid & personal', 'plus', 0.72, [
    ['Dettol Antiseptic 250ml', 380, { b: 1 }], ['Elastoplast plasters (10)', 120], ['Cotton wool 100g', 120], ['Surgical spirit 100ml', 100],
    ['Examination gloves (box 100)', 950], ['Face masks (box 50)', 400], ['Digital thermometer', 450, { st: 10 }], ['Durex condoms (3)', 350, { b: 1 }],
    ['Pregnancy test strip', 100, { b: 1 }], ['Glucose test strips (50)', 2200, { b: 1 }], ['Woodward\'s Gripe Water 150ml', 300, { b: 1 }]]]
];

const BOUTIQUE = [
  ['Men', 'shirt', 0.55, [
    ['Men\'s polo T-shirt', 1200, { v: { size: ['M', 'L', 'XL'], colour: ['Navy', 'White', 'Black'] }, f: 1 }],
    ['Men\'s official shirt', 1600, { v: { size: ['15.5', '16', '16.5'], colour: ['White', 'Sky blue'] } }],
    ['Slim-fit jeans', 2200, { v: { size: ['30', '32', '34', '36'], colour: ['Blue'] }, f: 1 }],
    ['Leather belt', 950], ['Baseball cap', 700], ['Socks (pair)', 150, { st: 80 }]]],
  ['Women', 'bag', 0.55, [
    ['Ankara dress', 2500, { v: { size: ['S', 'M', 'L'], colour: ['Red print', 'Blue print'] }, f: 1 }],
    ['Ladies blouse', 1400, { v: { size: ['S', 'M', 'L'], colour: ['Cream', 'Black'] } }],
    ['Ankara headwrap', 600], ['Kikoi wrap', 1500], ['Maasai shuka', 1200], ['Tote handbag', 2800], ['Sunglasses', 800]]],
  ['Shoes', 'tag', 0.6, [
    ['Canvas sneakers', 2800, { v: { size: ['39', '40', '41', '42', '43'], colour: ['White'] }, f: 1 }],
    ['Ladies heels', 3200, { v: { size: ['37', '38', '39', '40'], colour: ['Black'] } }],
    ['Leather sandals', 1800, { v: { size: ['40', '42', '44'], colour: ['Brown'] } }]]],
  ['Kids', 'smile', 0.58, [
    ['School sweater', 900, { v: { size: ['26', '28', '30'], colour: ['Navy', 'Maroon'] } }], ['Kids T-shirt', 550], ['Kids shorts', 600]]]
];

const ELECTRONICS = [
  ['Smartphones', 'phone', 0.86, [
    ['Tecno Spark 30 128GB', 17999, { sr: 1, f: 1, n: 'Warranty 12 months' }], ['Infinix Hot 50 128GB', 16500, { sr: 1, f: 1, n: 'Warranty 12 months' }],
    ['Samsung Galaxy A16 128GB', 21999, { sr: 1, n: 'Warranty 12 months' }], ['Samsung Galaxy A06 64GB', 12999, { sr: 1, n: 'Warranty 12 months' }],
    ['Itel A70 64GB', 8999, { sr: 1, n: 'Warranty 12 months' }], ['Redmi 14C 128GB', 15499, { sr: 1, n: 'Warranty 12 months' }],
    ['Safaricom Neon Ray 4G', 6499, { sr: 1, n: 'Warranty 12 months' }], ['Nokia 105 feature phone', 2300, { sr: 1, n: 'Warranty 6 months' }], ['Itel it2163 feature phone', 1250, { sr: 1, n: 'Warranty 6 months' }]]],
  ['Accessories', 'zap', 0.6, [
    ['Oraimo 20W charger', 1200, { f: 1 }], ['Oraimo power bank 20000mAh', 2800], ['Type-C cable 1m', 300, { f: 1, st: 60 }], ['Micro USB cable 1m', 200],
    ['Oraimo wired earphones', 450], ['Oraimo FreePods 4', 3500], ['Tempered glass screen protector', 300, { st: 80 }], ['Silicone phone cover', 400],
    ['Memory card 64GB', 950], ['Flash disk 32GB', 800], ['Oraimo smartwatch', 3800, { lo: 1 }], ['JBL Go 3 speaker', 4500]]],
  ['TV & home', 'monitor', 0.85, [
    ['Hisense 32" smart TV', 18500, { sr: 1, n: 'Warranty 24 months' }], ['Vitron 43" smart TV', 26000, { sr: 1, n: 'Warranty 12 months' }],
    ['Sayona 3.1 subwoofer', 6500], ['Ramtons electric kettle 1.7L', 1950], ['Von dry iron box', 2200], ['Mika blender 1.5L', 3800], ['d.light solar lamp', 1600], ['Extension cable 4-way', 950]]],
  ['Repairs & services', 'wrench', 0.3, [
    ['Screen replacement labour', 1000, { s: 60 }], ['Phone software flashing', 500, { s: 45 }], ['Charging port repair', 800, { s: 60 }], ['Phone setup & data transfer', 300, { s: 20 }]]],
  ['Airtime & SIM', 'wifi', 0.95, [
    ['Safaricom Airtime KES 100', 100, { t: 'D', ns: 1 }], ['Safaricom SIM card', 50, { t: 'D' }], ['Airtel SIM card', 50, { t: 'D' }]]]
];

const COSMETICS = [
  ['Skin care', 'droplet', 0.7, [
    ['Nivea Body Lotion 400ml', 590, { f: 1 }], ['Vaseline Intensive Care 400ml', 650, { f: 1 }], ['Shea butter 250g', 600], ['Dettol Soap 175g', 110],
    ['Nice & Lovely lotion 400ml', 380], ['Garnier facial wash 100ml', 650], ['Sunscreen SPF 50 100ml', 1450], ['Coco butter 500ml', 720]]],
  ['Hair care', 'scissors', 0.7, [
    ['Dark & Lovely relaxer kit', 750, { f: 1 }], ['ORS Olive Oil cream 227g', 950], ['Movit hair food 100g', 120], ['Darling braids pack', 280, { f: 1, st: 120 }],
    ['Brazilian weave (3 bundles)', 4500], ['Synthetic wig (bob)', 3500], ['Hair spray 250ml', 450], ['Edge control gel', 350], ['Satin bonnet', 300]]],
  ['Makeup', 'sparkle', 0.6, [
    ['Black Opal foundation', 1800], ['Matte lipstick', 450, { f: 1 }], ['Lip gloss', 250], ['Eyebrow pencil', 150], ['Mascara', 650], ['Eyeliner', 350],
    ['Pressed powder', 750], ['Makeup brush set (7)', 1200], ['Makeup sponge', 150], ['False eyelashes', 250]]],
  ['Nails', 'gift', 0.55, [['Nail polish', 150], ['Artificial nails set', 300], ['Nail polish remover 100ml', 150], ['Nail file', 50], ['Cuticle oil', 250]]],
  ['Fragrance', 'star', 0.6, [['Eau de parfum 100ml (oud)', 1800], ['Body mist 250ml', 650], ['Roll-on deodorant 50ml', 280], ['Body spray 150ml', 350], ['Gift set (lotion & mist)', 2200, { lo: 1 }]]],
  ['Men\'s grooming', 'user', 0.62, [['Beard oil 30ml', 600], ['Shaving cream', 350], ['Aftershave 100ml', 900], ['Gillette Blue II Razors (5)', 250], ['Hair clipper (rechargeable)', 2500]]]
];

const BUTCHERY = [
  ['Beef', 'scale', 0.78, [
    ['Beef with bones (kg)', 650, { t: 'A', w: 1, f: 1, st: 80 }], ['Beef boneless steak (kg)', 800, { t: 'A', w: 1, f: 1, st: 40 }], ['Beef mince (kg)', 850, { t: 'A', w: 1 }],
    ['Beef fillet (kg)', 1100, { t: 'A', w: 1 }], ['Ox tail (kg)', 750, { t: 'A', w: 1 }], ['Beef liver (kg)', 700, { t: 'A', w: 1 }], ['Matumbo / tripe (kg)', 450, { t: 'A', w: 1 }],
    ['Beef kidney (kg)', 600, { t: 'A', w: 1 }], ['Beef bones for soup (kg)', 250, { t: 'A', w: 1 }]]],
  ['Goat & mutton', 'scale', 0.8, [
    ['Goat meat (kg)', 850, { t: 'A', w: 1, f: 1, st: 40 }], ['Mutton (kg)', 800, { t: 'A', w: 1 }], ['Goat ribs (kg)', 900, { t: 'A', w: 1 }], ['Goat head & legs (set)', 600, { t: 'A' }]]],
  ['Chicken & pork', 'flame', 0.78, [
    ['Kienyeji chicken (whole)', 1100, { t: 'A' }], ['Broiler chicken (whole)', 650, { t: 'A', f: 1 }], ['Chicken wings (kg)', 600, { t: 'A', w: 1 }], ['Chicken gizzards (kg)', 500, { t: 'A', w: 1 }],
    ['Pork chops (kg)', 750, { t: 'A', w: 1 }], ['Pork ribs (kg)', 700, { t: 'A', w: 1 }]]],
  ['Fish', 'droplet', 0.75, [['Tilapia whole (kg)', 500, { t: 'A', w: 1 }], ['Omena (kg)', 300, { t: 'A', w: 1 }], ['Nile perch fillet (kg)', 900, { t: 'A', w: 1, lo: 1 }]]],
  ['Sausages & processed', 'package', 0.8, [
    ['Farmers Choice Beef Sausages 500g', 420], ['Farmers Choice Smokies (10)', 330], ['Mutura (each)', 50, { t: 'A' }], ['Bacon 250g', 480], ['Beef samosa (each)', 40]]],
  ['Choma & sides', 'utensils', 0.5, [
    ['Nyama choma beef (kg)', 1200, { w: 1 }], ['Nyama choma goat (kg)', 1400, { w: 1, f: 1 }], ['Ugali (plate)', 60, { t: 'A' }], ['Kachumbari', 50, { t: 'A' }], ['Mukimo (plate)', 100, { t: 'A' }], ['Soda 500ml', 80]]],
  ['Spices & extras', 'sparkle', 0.75, [['Royco Mchuzi Mix 200g', 115], ['Tenderiser 100g', 150], ['Meat masala 50g', 80], ['Charcoal (4kg tin)', 200, { t: 'A' }], ['Kensalt 1kg', 45, { t: 'A' }]]]
];

const BAKERY = [
  ['Bread', 'package', 0.55, [
    ['White bread 400g (our bake)', 60, { t: 'A', f: 1, st: 60 }], ['Brown bread 400g (our bake)', 65, { t: 'A' }], ['Bread rolls (6)', 90, { t: 'A' }], ['Banana bread loaf', 450],
    ['Sweet bun', 30, { f: 1 }], ['Baguette', 120]]],
  ['Snacks', 'coffee', 0.45, [
    ['Mandazi (each)', 10, { f: 1, st: 200 }], ['Chapati (each)', 25, { f: 1 }], ['Doughnut (each)', 30], ['Queen cake (each)', 20], ['Scone (each)', 30], ['Croissant', 80],
    ['Meat pie', 80], ['Beef samosa', 50], ['Sausage roll', 70], ['Cupcake', 60]]],
  ['Cakes', 'cake', 0.5, [
    ['Vanilla cake 1kg', 1500, { rec: [['Baking flour (kg)', 0.5], ['Sugar (kg)', 0.3], ['Eggs (each)', 6], ['Margarine (kg)', 0.25]], f: 1 }],
    ['Chocolate cake 1kg', 1800, { rec: [['Baking flour (kg)', 0.45], ['Sugar (kg)', 0.3], ['Eggs (each)', 6], ['Margarine (kg)', 0.25], ['Cocoa powder (kg)', 0.08]] }],
    ['Black forest cake 1kg', 2200, { rec: [['Baking flour (kg)', 0.45], ['Sugar (kg)', 0.35], ['Eggs (each)', 6], ['Cocoa powder (kg)', 0.1], ['Whipping cream (L)', 0.3]] }],
    ['Red velvet cake 1kg', 2400, { rec: [['Baking flour (kg)', 0.5], ['Sugar (kg)', 0.35], ['Eggs (each)', 6], ['Margarine (kg)', 0.25], ['Icing sugar (kg)', 0.2]] }],
    ['Birthday cake 2kg (custom)', 4500, { rec: [['Baking flour (kg)', 1], ['Sugar (kg)', 0.7], ['Eggs (each)', 12], ['Margarine (kg)', 0.5], ['Icing sugar (kg)', 0.5]] }],
    ['Cake slice', 150, { f: 1 }], ['Fruit cake 500g', 750]]],
  ['Drinks', 'coffee', 0.4, [['Tea (cup)', 40, { f: 1 }], ['Coffee (cup)', 80], ['Hot chocolate', 150], ['Fresh juice 300ml', 120], ['Soda 500ml', 80], ['Brookside Milk 500ml', 65, { t: 'A' }], ['Water 500ml', 50]]],
  ['Ingredients', 'layers', 0.9, [
    ['Baking flour (kg)', 100, { u: 'kg', st: 120 }], ['Sugar (kg)', 185, { u: 'kg', st: 80 }], ['Eggs (each)', 15, { st: 400 }], ['Margarine (kg)', 450, { u: 'kg', st: 30 }],
    ['Cocoa powder (kg)', 1600, { u: 'kg', st: 6 }], ['Icing sugar (kg)', 250, { u: 'kg', st: 20 }], ['Whipping cream (L)', 900, { u: 'l', st: 10, lo: 1 }], ['Yeast 500g', 400], ['Cake box 1kg', 60, { st: 100 }]]]
];

const RESTAURANT = [
  ['Breakfast', 'sun', 0.38, [
    ['Full Kenyan breakfast', 650, { kit: 'kitchen', mods: ['eggs'], f: 1 }], ['Spanish omelette', 350, { kit: 'kitchen' }], ['Pancakes (3)', 300, { kit: 'kitchen' }],
    ['Mandazi & tea', 150, { kit: 'kitchen' }], ['Sausage, eggs & toast', 450, { kit: 'kitchen', mods: ['eggs'] }]]],
  ['Mains', 'utensils', 0.4, [
    ['Beef stew & ugali', 450, { kit: 'kitchen', mods: ['sides'], f: 1 }], ['Chicken stew & rice', 550, { kit: 'kitchen', mods: ['sides'] }],
    ['Nyama choma goat 1/2kg', 750, { kit: 'kitchen', mods: ['sides'], f: 1 }], ['Tilapia fry & ugali', 850, { kit: 'kitchen', mods: ['sides'] }],
    ['Beef pilau', 450, { kit: 'kitchen', f: 1 }], ['Githeri special', 300, { kit: 'kitchen' }], ['Chapati & beans', 250, { kit: 'kitchen' }],
    ['Beef burger & chips', 650, { kit: 'kitchen', mods: ['done', 'extras'] }], ['Chicken burger & chips', 650, { kit: 'kitchen', mods: ['extras'] }],
    ['T-bone steak & chips', 1100, { kit: 'kitchen', mods: ['done', 'sides'] }], ['Chicken biryani', 750, { kit: 'kitchen' }], ['Vegetable curry & rice', 450, { kit: 'kitchen' }],
    ['Mukimo & beef', 550, { kit: 'kitchen' }]]],
  ['Snacks', 'flame', 0.35, [
    ['Chips plain', 200, { kit: 'kitchen', f: 1 }], ['Chips masala', 300, { kit: 'kitchen' }], ['Samosa (2)', 100, { kit: 'kitchen' }], ['Smokie pasua', 70, { kit: 'kitchen' }],
    ['Chicken wings (6)', 550, { kit: 'kitchen' }], ['Bhajia', 250, { kit: 'kitchen' }]]],
  ['Drinks', 'coffee', 0.35, [
    ['African tea', 100, { kit: 'bar', mods: ['sugar'], f: 1 }], ['Black coffee', 150, { kit: 'bar', mods: ['sugar'] }], ['Cappuccino', 250, { kit: 'bar', mods: ['sugar'] }],
    ['Cafe latte', 280, { kit: 'bar', mods: ['sugar'] }], ['Dawa (honey, lemon, ginger)', 200, { kit: 'bar' }], ['Fresh passion juice', 200, { kit: 'bar' }],
    ['Mango smoothie', 300, { kit: 'bar' }], ['Soda 500ml', 100, { kit: 'bar', st: 120 }], ['Water 500ml', 70, { kit: 'bar', st: 100 }]]],
  ['Desserts', 'cake', 0.35, [['Fruit salad', 250, { kit: 'kitchen' }], ['Ice cream (2 scoops)', 300, { kit: 'bar' }], ['Chocolate cake slice', 250, { kit: 'bar' }]]]
];

const BAR = [
  ['Beer', 'wine', 0.78, [
    ['Tusker Lager 500ml', 300, { f: 1, st: 200, uom: [['Crate (25)', 25, 6800]], kit: 'bar' }], ['Tusker Malt 500ml', 320, { uom: [['Crate (25)', 25, 7300]], kit: 'bar' }],
    ['Guinness 500ml', 330, { f: 1, uom: [['Crate (25)', 25, 7600]], kit: 'bar' }], ['White Cap Lager 500ml', 300, { f: 1, uom: [['Crate (25)', 25, 6800]], kit: 'bar' }],
    ['Pilsner Lager 500ml', 280, { kit: 'bar' }], ['Balozi Lager 500ml', 280, { kit: 'bar' }], ['Heineken 330ml', 330, { kit: 'bar' }],
    ['Hunter\'s Gold Cider 330ml', 300, { kit: 'bar' }], ['Snapp 330ml', 300, { kit: 'bar' }], ['Faxe 500ml can', 380, { kit: 'bar', lo: 1 }]]],
  ['Spirits', 'flame', 0.72, [
    ['Kenya Cane 750ml', 1300, { kit: 'bar' }], ['Kenya Cane 250ml', 450, { kit: 'bar', f: 1 }], ['Chrome Vodka 250ml', 350, { kit: 'bar' }], ['Smirnoff Vodka 750ml', 1900, { kit: 'bar' }],
    ['Gilbey\'s Gin 750ml', 1900, { kit: 'bar' }], ['Gilbey\'s Gin 250ml', 650, { kit: 'bar' }], ['Johnnie Walker Black 750ml', 5500, { kit: 'bar' }],
    ['Jameson 750ml', 3600, { kit: 'bar' }], ['Captain Morgan 750ml', 1800, { kit: 'bar' }], ['Hennessy VS 700ml', 7500, { kit: 'bar' }]]],
  ['Tots & cocktails', 'sparkle', 0.4, [
    ['Jameson (single tot)', 300, { kit: 'bar', ns: 1 }], ['Johnnie Walker Black (single tot)', 400, { kit: 'bar', ns: 1 }], ['Gilbey\'s Gin & tonic', 350, { kit: 'bar', ns: 1 }],
    ['Dawa cocktail', 450, { kit: 'bar', ns: 1, f: 1 }], ['Mojito', 600, { kit: 'bar', ns: 1 }]]],
  ['Wine', 'wine', 0.7, [['Four Cousins Sweet Red 750ml', 1250, { kit: 'bar' }], ['Caprice Red 750ml', 900, { kit: 'bar' }], ['Drostdy-Hof Merlot 750ml', 1600, { kit: 'bar' }], ['Glass of house wine', 350, { kit: 'bar', ns: 1 }]]],
  ['Soft drinks', 'droplet', 0.7, [['Coca-Cola 500ml', 100, { kit: 'bar' }], ['Tonic water 300ml', 120, { kit: 'bar' }], ['Red Bull 250ml', 250, { kit: 'bar' }], ['Keringet Water 1L', 120, { kit: 'bar' }], ['Soda water 300ml', 100, { kit: 'bar' }]]],
  ['Grill & food', 'utensils', 0.4, [
    ['Goat choma 1kg', 1400, { kit: 'kitchen', mods: ['sides'], f: 1 }], ['Kuku choma (quarter)', 450, { kit: 'kitchen', mods: ['sides'] }], ['Chicken wings (6)', 550, { kit: 'kitchen' }],
    ['Chips plain', 200, { kit: 'kitchen' }], ['Kachumbari', 100, { kit: 'kitchen' }], ['Matumbo fry', 400, { kit: 'kitchen' }], ['Mutura (each)', 100, { kit: 'kitchen' }]]]
];

const SALON = [
  ['Hair', 'scissors', 0.15, [
    ['Wash & blow dry', 500, { s: 45, f: 1 }], ['Wash & set', 800, { s: 60 }], ['Relaxer retouch', 1500, { s: 90, f: 1 }], ['Box braids (medium)', 3500, { s: 240 }],
    ['Cornrows all-back', 800, { s: 60 }], ['Knotless braids', 4500, { s: 300 }], ['Weave installation', 1500, { s: 120 }], ['Dreadlocks retwist', 1500, { s: 120 }],
    ['Deep conditioning treatment', 1000, { s: 45 }], ['Hair colour', 2000, { s: 90 }]]],
  ['Barber', 'user', 0.1, [['Haircut (men)', 300, { s: 30, f: 1 }], ['Haircut & shave', 400, { s: 40, f: 1 }], ['Kids haircut', 200, { s: 20 }], ['Beard trim & shape', 150, { s: 15 }], ['Hair dye (men)', 500, { s: 30 }]]],
  ['Nails', 'gift', 0.2, [['Manicure', 600, { s: 40, f: 1 }], ['Pedicure', 900, { s: 60, f: 1 }], ['Gel polish', 1200, { s: 45 }], ['Acrylic nails full set', 2500, { s: 90 }], ['Nail art (per hand)', 300, { s: 20 }]]],
  ['Spa & beauty', 'sparkle', 0.2, [
    ['Facial (basic)', 1500, { s: 60 }], ['Eyebrow shaping', 200, { s: 15 }], ['Eyelash extensions', 2000, { s: 90 }], ['Full body massage (60 min)', 3000, { s: 60 }],
    ['Event makeup', 2500, { s: 60 }], ['Leg waxing', 1500, { s: 45 }]]],
  ['Products', 'bag', 0.65, [
    ['Darling braids pack', 300, { st: 80 }], ['Dark & Lovely shampoo 250ml', 650], ['Movit hair food 100g', 120], ['Olive oil hair spray 250ml', 550], ['Beard oil 30ml', 600],
    ['Nail polish', 200], ['Edge control gel', 350], ['Satin bonnet', 300, { lo: 1 }]]]
];

const STATIONERY = [
  ['Cyber services', 'monitor', 0.2, [
    ['Printing B/W (page)', 10, { s: 1, f: 1 }], ['Printing colour (page)', 30, { s: 1 }], ['Photocopy (page)', 5, { s: 1, f: 1 }], ['Scanning (page)', 20, { s: 2 }],
    ['Typing (page)', 50, { s: 15 }], ['Lamination A4', 70, { s: 3 }], ['Spiral binding', 150, { s: 10 }], ['Passport photos (4)', 200, { s: 10 }],
    ['KRA PIN registration', 300, { s: 15 }], ['KRA returns filing', 500, { s: 20, f: 1 }], ['eCitizen application help', 300, { s: 20 }], ['Internet browsing (30 min)', 50, { s: 30 }],
    ['CV writing', 500, { s: 45 }], ['HELB application help', 300, { s: 20 }]]],
  ['Books', 'book', 0.72, [
    ['Exercise book 96 pages', 45, { t: 'A', f: 1, st: 300 }], ['Exercise book 200 pages', 90, { t: 'A' }], ['Counter book 4 quire', 250, { t: 'A' }], ['Atlas (secondary)', 950, { t: 'A' }],
    ['Oxford Learner\'s Dictionary', 2200, { t: 'A' }], ['KCSE revision (Mathematics)', 650, { t: 'A' }], ['Story book (class 4)', 350, { t: 'A' }]]],
  ['Writing', 'edit', 0.6, [
    ['Bic pen blue', 20, { f: 1, st: 400 }], ['Bic pen red', 20], ['Pencil HB', 15], ['Eraser', 10], ['Sharpener', 10], ['Ruler 30cm', 30], ['Oxford maths set', 350],
    ['Casio fx-82 calculator', 1850, { st: 8 }], ['Marker pen', 80], ['Highlighter', 80], ['Crayons (12)', 120]]],
  ['Paper & office', 'file', 0.75, [
    ['A4 paper ream (500)', 750, { f: 1 }], ['Manila paper', 15], ['A4 brown envelope', 10], ['Glue stick', 80], ['Stapler', 350], ['Staples (box)', 60], ['Box file', 250],
    ['Spring file', 50], ['Flash disk 32GB', 800], ['School bag', 1200, { lo: 1 }]]]
];

const WHOLESALE = [
  ['Flour & cereals', 'package', 0.92, [
    ['Jogoo Maize Flour 2kg', 165, { t: 'A', ws: [150, 12], uom: [['Bale (12)', 12, 1800]], f: 1, st: 600 }], ['Soko Maize Flour 2kg', 155, { t: 'A', ws: [142, 12], uom: [['Bale (12)', 12, 1700]] }],
    ['Exe Wheat Flour 2kg', 195, { t: 'A', ws: [180, 12], uom: [['Bale (12)', 12, 2150]] }], ['Pishori Rice 25kg bag', 5200, { t: 'A', ws: [4950, 5] }],
    ['Kabras Sugar 1kg', 185, { ws: [172, 20], uom: [['Bale (20)', 20, 3440]], f: 1, st: 500 }], ['Mumias Sugar 50kg bag', 8500, { ws: [8200, 5] }],
    ['Green grams 90kg bag', 13500, { t: 'A' }], ['Beans Rosecoco 90kg bag', 12000, { t: 'A' }]]],
  ['Cooking oil & fats', 'droplet', 0.92, [
    ['Golden Fry 1L', 350, { ws: [325, 12], uom: [['Carton (12)', 12, 3900]] }], ['Elianto 3L', 1150, { ws: [1080, 6], uom: [['Carton (6)', 6, 6480]] }],
    ['Salit 20L jerrican', 6200, { ws: [5950, 3], f: 1 }], ['Kimbo 1kg', 430, { ws: [405, 12], uom: [['Carton (12)', 12, 4860]] }],
    ['Kasuku 2kg', 760, { ws: [720, 6], uom: [['Carton (6)', 6, 4320]] }], ['Blue Band 500g', 270, { ws: [252, 24], uom: [['Carton (24)', 24, 6050]] }]]],
  ['Soaps & detergents', 'sparkle', 0.9, [
    ['Omo 1kg', 330, { ws: [305, 12], uom: [['Carton (12)', 12, 3660]] }], ['Menengai Bar Soap 1kg', 210, { ws: [195, 20], uom: [['Carton (20)', 20, 3900]], f: 1 }],
    ['Toss 500g', 120, { ws: [110, 24], uom: [['Carton (24)', 24, 2640]] }], ['Geisha Soap 90g', 45, { ws: [40, 48], uom: [['Carton (48)', 48, 1920]] }],
    ['Jik 750ml', 165, { ws: [152, 12], uom: [['Carton (12)', 12, 1820]] }], ['Rosy Tissue (10)', 350, { ws: [325, 10], uom: [['Bale (10 packs)', 10, 3250]] }]]],
  ['Beverages', 'coffee', 0.9, [
    ['Ketepa Pride 250g', 230, { ws: [212, 24], uom: [['Carton (24)', 24, 5090]] }], ['Coca-Cola 500ml', 80, { ws: [70, 24], uom: [['Crate (24)', 24, 1680]], f: 1 }],
    ['Dasani 500ml', 50, { ws: [42, 24], uom: [['Pack (24)', 24, 1010]] }], ['Afia Juice 1L', 180, { ws: [165, 12], uom: [['Carton (12)', 12, 1980]] }],
    ['Brookside Milk 500ml', 65, { t: 'A', ws: [58, 24], uom: [['Crate (24)', 24, 1390]] }], ['Nescafe Classic 50g', 330, { ws: [305, 24] }]]],
  ['Snacks & sweets', 'gift', 0.88, [
    ['Nuvita Biscuits 200g', 75, { ws: [68, 24], uom: [['Carton (24)', 24, 1630]] }], ['Tropical Heat Crisps 80g', 70, { ws: [62, 24], uom: [['Carton (24)', 24, 1490]] }],
    ['Big G Bubblegum (jar 100)', 400, { ws: [370, 6] }], ['Orbit Chewing Gum (box 20)', 650, { ws: [600, 6] }], ['Valon Sweets (jar 200)', 500, { lo: 1 }]]],
  ['Personal care', 'smile', 0.88, [
    ['Colgate 140g', 210, { ws: [195, 24], uom: [['Carton (24)', 24, 4680]] }], ['Always Ultra (8)', 110, { ws: [100, 24], uom: [['Carton (24)', 24, 2400]] }],
    ['Vaseline 250ml', 360, { ws: [335, 12], uom: [['Carton (12)', 12, 4020]] }], ['Nivea Lotion 400ml', 590, { ws: [550, 12] }],
    ['Huggies Size 4 (42)', 1650, { ws: [1560, 4] }], ['Gillette Blue II (5)', 250, { ws: [228, 24] }]]]
];

const AUTOSPARES = [
  ['Filters', 'filter', 0.65, [
    ['Oil filter Toyota 90915', 650, { f: 1, st: 40 }], ['Air filter Probox', 900], ['Air filter Fielder', 950], ['Fuel filter Toyota', 750], ['Cabin filter', 850]]],
  ['Brakes', 'ban', 0.62, [
    ['Brake pads front Probox', 2200, { f: 1 }], ['Brake pads front Fielder', 2400], ['Brake shoes rear Probox', 2000], ['Brake fluid DOT3 500ml', 450], ['Brake disc Probox', 4200]]],
  ['Oils & fluids', 'droplet', 0.78, [
    ['Total Quartz 5W-30 4L', 4200, { f: 1 }], ['Engine oil 15W-40 5L', 3600, { f: 1 }], ['Gear oil 80W-90 1L', 900], ['ATF Dexron III 1L', 950], ['Coolant 1L', 550], ['Grease 500g', 450]]],
  ['Engine & electrical', 'zap', 0.65, [
    ['NGK spark plug (each)', 450, { f: 1 }], ['Fan belt', 900], ['Timing belt kit', 6500], ['Clutch plate Probox', 5500], ['Fuel pump Toyota', 4800],
    ['Radiator cap', 450], ['Headlight bulb H4', 450], ['Battery N50 (Chloride Exide)', 9500, { st: 6 }], ['Battery N70 (Chloride Exide)', 12500, { st: 4, lo: 1 }], ['Alternator brushes', 650]]],
  ['Suspension & tyres', 'car', 0.7, [
    ['Shock absorber front Probox', 4800], ['Shock absorber rear Probox', 4200], ['Tyre 185/65 R15', 7500, { st: 12 }], ['Tyre 175/70 R14', 6500], ['Ball joint', 1800], ['Stabiliser link', 1200]]],
  ['Body & accessories', 'sparkle', 0.6, [
    ['Wiper blades (pair)', 800], ['Side mirror Probox', 1800], ['Car mats (set)', 2500], ['Car seat covers (set)', 6500], ['Number plate frame', 500], ['Reflective triangle', 650], ['Fire extinguisher 1kg', 1800]]],
  ['Labour', 'wrench', 0.2, [['Fitting labour', 500, { s: 30 }], ['Oil change service', 800, { s: 30, f: 1 }], ['Wheel alignment', 1500, { s: 45 }], ['Diagnosis (OBD scan)', 1000, { s: 30 }]]]
];

const GAS_WATER = [
  ['Gas refills', 'flame', 0.88, [
    ['K-Gas 6kg refill', 1250, { f: 1, st: 40 }], ['K-Gas 13kg refill', 2950, { f: 1 }], ['Total Gas 6kg refill', 1300, { f: 1 }], ['Total Gas 13kg refill', 3050],
    ['Pro Gas 6kg refill', 1250], ['Pro Gas 13kg refill', 2950], ['Hashi Gas 6kg refill', 1200], ['Hashi Gas 13kg refill', 2900], ['Afrigas 6kg refill', 1250],
    ['Afrigas 13kg refill', 2950], ['Rubis Gas 6kg refill', 1280], ['Rubis Gas 13kg refill', 3000]]],
  ['New cylinders', 'package', 0.85, [
    ['K-Gas 6kg cylinder (full)', 4200], ['K-Gas 13kg cylinder (full)', 8500], ['Total Gas 6kg cylinder (full)', 4300], ['Pro Gas 6kg cylinder (full)', 4100],
    ['Cylinder deposit 6kg', 2500, { t: 'D', n: 'Refundable deposit' }], ['Cylinder deposit 13kg', 4500, { t: 'D', n: 'Refundable deposit' }]]],
  ['Gas accessories', 'wrench', 0.65, [
    ['Burner & grill (6kg)', 950, { f: 1 }], ['Regulator 13kg', 1200], ['Gas hose pipe (1m)', 250], ['Hose clips (pair)', 80], ['Two-burner table cooker', 3800], ['Gas lighter', 150]]],
  ['Water', 'droplet', 0.35, [
    ['Water refill 20L', 50, { f: 1, ns: 1 }], ['Water refill 10L', 30, { ns: 1 }], ['Water refill 5L', 20, { ns: 1 }], ['Purified water 20L (new bottle)', 650],
    ['Empty bottle 20L', 450], ['Dispenser tap', 250], ['Hot & cold water dispenser', 12500, { st: 3 }], ['Bottled water 1L', 60], ['Ice cubes 2kg', 100], ['Bottle cap seal', 10]]],
  ['Fuel & cooking', 'sun', 0.8, [['Kerosene (litre)', 160, { u: 'l' }], ['Charcoal (4kg tin)', 200, { t: 'A' }], ['Charcoal briquettes 2kg', 180], ['Ceramic jiko', 650], ['Matches (pack of 10)', 30], ['Delivery (within 3 km)', 100, { s: 20, t: 'D' }]]]
];

const OTHER = [
  ['Services', 'wrench', 0.2, [
    ['Consultation (1 hour)', 1500, { s: 60, f: 1 }], ['Site visit', 2500, { s: 120 }], ['Installation labour', 1000, { s: 60 }], ['Repair labour', 800, { s: 45, f: 1 }],
    ['Delivery (within town)', 200, { s: 30 }], ['Training session', 3000, { s: 120 }], ['Monthly maintenance', 5000, { s: 60 }], ['Design work (hour)', 1200, { s: 60 }]]],
  ['Printing & office', 'print', 0.3, [
    ['Printing B/W (page)', 10, { s: 1, f: 1 }], ['Photocopy (page)', 5, { s: 1 }], ['Lamination A4', 70, { s: 3 }], ['Typing (page)', 50, { s: 15 }], ['Passport photos (4)', 200, { s: 10 }],
    ['A4 paper ream', 750], ['Bic pen blue', 20], ['Box file', 250]]],
  ['Shop items', 'store', 0.82, [
    ['Brookside Milk 500ml', 65, { t: 'A' }], ['Supa Loaf White Bread 400g', 65, { t: 'A' }], ['Coca-Cola 500ml', 80, { f: 1 }], ['Dasani Water 500ml', 50], ['Kabras Sugar 1kg', 185],
    ['Jogoo Maize Flour 2kg', 165, { t: 'A' }], ['Ketepa Pride Tea 100g', 95], ['Royco Mchuzi Mix 200g', 115], ['Omo Washing Powder 1kg', 330], ['Geisha Bathing Soap 90g', 45]]],
  ['Phone & digital', 'phone', 0.7, [
    ['Safaricom Airtime KES 100', 100, { t: 'D', ns: 1, f: 1 }], ['Safaricom Airtime KES 50', 50, { t: 'D', ns: 1 }], ['Type-C cable 1m', 300], ['Oraimo 20W charger', 1200],
    ['Flash disk 32GB', 800], ['Earphones', 450], ['Phone cover', 400], ['Screen protector', 300]]],
  ['Hardware basics', 'wrench', 0.75, [['LED bulb 9W', 150], ['Extension cable 4-way', 950], ['Padlock 40mm', 650], ['Torch (rechargeable)', 850], ['Batteries AA (2)', 100], ['Super glue', 80], ['Duct tape', 250]]]
];

export const CATALOGUES = {
  duka: DUKA, minimart: [...DUKA, ...MINIMART_EXTRA], hardware: HARDWARE, agrovet: AGROVET, pharmacy: PHARMACY, boutique: BOUTIQUE,
  electronics: ELECTRONICS, cosmetics: COSMETICS, butchery: BUTCHERY, bakery: BAKERY, restaurant: RESTAURANT, bar: BAR, salon: SALON,
  stationery: STATIONERY, wholesale: WHOLESALE, autospares: AUTOSPARES, gas_water: GAS_WATER, other: OTHER
};

export const MODIFIER_GROUPS = [
  { id: 'mg-sides', key: 'sides', name: 'Side', min: 0, max: 1, options: [{ name: 'Ugali', price: 0 }, { name: 'Rice', price: 0 }, { name: 'Chips', price: 5000 }, { name: 'Chapati (2)', price: 5000 }, { name: 'Mukimo', price: 5000 }] },
  { id: 'mg-done', key: 'done', name: 'How cooked', min: 1, max: 1, options: [{ name: 'Medium rare', price: 0 }, { name: 'Medium', price: 0 }, { name: 'Well done', price: 0 }] },
  { id: 'mg-extras', key: 'extras', name: 'Extras', min: 0, max: 3, options: [{ name: 'Extra cheese', price: 8000 }, { name: 'Avocado', price: 6000 }, { name: 'Fried egg', price: 4000 }, { name: 'Bacon', price: 10000 }] },
  { id: 'mg-eggs', key: 'eggs', name: 'Eggs', min: 0, max: 1, options: [{ name: 'Fried', price: 0 }, { name: 'Scrambled', price: 0 }, { name: 'Boiled', price: 0 }, { name: 'Spanish', price: 3000 }] },
  { id: 'mg-sugar', key: 'sugar', name: 'Sugar', min: 0, max: 1, options: [{ name: 'No sugar', price: 0 }, { name: 'Less sugar', price: 0 }, { name: 'Normal', price: 0 }] }
];

export const TABLES = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ name: 'T' + n, area: 'Main hall', seats: n % 3 === 0 ? 6 : 4, shape: n % 3 === 0 ? 'rect' : 'round', x: ((n - 1) % 4) * 140 + 40, y: Math.floor((n - 1) / 4) * 140 + 40 })),
  ...[9, 10, 11, 12].map((n, i) => ({ name: 'T' + n, area: 'Terrace', seats: 2, shape: 'round', x: i * 140 + 40, y: 40 })),
  ...[1, 2, 3].map((n, i) => ({ name: 'Bar ' + n, area: 'Bar counter', seats: 1, shape: 'round', x: i * 100 + 40, y: 40 }))
];
