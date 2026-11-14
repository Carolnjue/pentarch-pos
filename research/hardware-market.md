# Pentarch POS: Kenyan Hardware, Competitor and Compliance Research

Prices were checked on 9 Nov 2026 unless another date is given. All prices are in KES. "ex VAT" means the seller adds 16% VAT at checkout. Where a source does not say whether VAT is included, I treat the price as shown. **Estimates are labelled as estimates.**

**How the prices were collected.** Jiji (jiji.co.ke) listing pages could not be fetched because the site blocks automated reads. Some Jiji listings appear in search results, but their prices are **not verified**. Jumia search pages are also blocked, but Jumia product pages and "slp" category pages could be read. Specialist shops that show prices were used as the main sources: Rondamo, Potent IT, Onside Tech, Glantix, Patam, Rapidtech, TDK, Editech, Almiria, Lapsol, Kenyatronics, Homelink and Skywave.

---

## 1. Hardware

### a. Barcode scanner: **Syble XB-6255M 2D wired USB handheld**
- **Why this one.** It is the cheapest 2D imager sold by several Kenyan POS shops. It reads 1D (EAN/UPC/Code128), QR, PDF417 and Data Matrix codes, and it can read **phone screens**, which matters for M-Pesa QR codes, e-vouchers and loyalty QR codes. It works as a USB-HID keyboard wedge and needs no driver. A 1D laser scanner such as the Syble XB-2055 costs only about 500 less (KES 3,000 at Rondamo) and cannot read QR codes or screens, so 2D is the better buy.
- **Key specs.** CMOS imager, rated up to 300 scans/s, manual/auto/continuous modes, USB HID / RS232 / keyboard wedge.
- **Connection.** Wired USB.

| Seller | Price | URL |
|---|---|---|
| Almiria | 3,500 ex VAT (4,060 incl.) | https://almiria.co.ke/catalogue/syble-xb-6255m-2d-barcode-scanner_2364 |
| Rondamo | 3,500 | https://rondamo.co.ke/product-category/point-of-sale-systems-pos-7l (listing "Syble XB-6255M 2D Wired Barcode Scanner") |
| Editech | 5,000 | https://www.editech.co.ke/?p=10451 |

**Recommended buy price: about KES 4,000** (incl. VAT).

Upgrade references, which are much dearer:
- Honeywell Voyager 1470g: KES 17,500 at Digital Store (https://www.digitalstore.co.ke/products/honeywel-2d-usb-omnidirectional-scanner-1470g2d-2usb-1-r-usb-rs-232-ps-2-supported-codes-2d-1d-protection-rating-ip40)
- Zebra DS2208-SR: KES 25,500 ex VAT at Rapidtech (https://rapidtech.co.ke/zebra-ds2208-sr7u2100sgw-barcode-scanner) and KES 26,400 at Digital Nest (https://digitalnest.co.ke/products/zebra-ds2208-sr-corded-handheld-1d-2d-barcode-scanner-with-stand-and-shielded-usb-cable-ds2208-sr7u2100sgw)
- X-POS XP-2800 2D: KES 14,500 at Potent (https://potent.it.com/product-category/pos-systems/barcode-scanners/)

### b. Receipt printer: **Xprinter XP-Q80A (80mm, USB + LAN, auto-cutter)**
- **Why this one.** It is the standard low-cost Kenyan POS printer and is stocked by many shops. It works with the normal Windows driver, so browser printing works. ESC/POS support keeps the option of raw printing later. LAN lets several tills share one printer, or lets a kitchen printer sit on the network. Its drawer kick port suits the drawer below.
- **Key specs.**
  - 80mm direct thermal at 203 dpi, 200–230 mm/s
  - Partial-cut auto-cutter rated for about 1.5 million cuts
  - Ports: USB, LAN and serial
  - **RJ11 cash-drawer port, 24V / 1A** (per Potent's spec sheet)
- **Connection.** USB plus Ethernet (LAN).

| Seller | Price | URL |
|---|---|---|
| Glantix | 7,000 ex VAT (8,120 incl.) | https://glantix.co.ke/product-category/printers-office/label-printers |
| Onside Tech | 7,500 ex VAT, in stock | https://www.onsidetechsolutions.co.ke/?p=20772 |
| Potent IT | 7,500 (standard) – 8,500 (variant) | https://potent.it.com/?p=14840 |
| Jumia ("XPrinter 80mm USB Plus LAN", model not named) | 6,549 | jumia.co.ke printer category (listing seen on 9 Nov 2026) |
| Techlion shop ("Thermal Receipt Printer USB/Ethernet", unbranded) | 6,500 | https://techlion.co.ke/shop/ |

**Recommended buy price: about KES 8,000** (incl. VAT). Upgrade reference: Epson TM-T20III Ethernet at KES 36,100 on Jumia.

### c. Cash drawer: **EPOS ECH-410 (5 bill / 8 coin, RJ11, 12/24V)**
- **Why this one.** It is the common heavy-gauge drawer in Kenyan shops and can be bought from several sellers. It has 5 note slots, 8 coin cups, 2 media slots, a 3-position key lock and an RJ11/RJ12 cable. It works at **12V or 24V**, so it fires from the XP-Q80A's 24V port.
- **Key specs.** 410 × 415 × 100 mm, about 6.5 kg, cold-rolled steel.
- **Connection.** RJ11 cable to the printer's drawer-kick port. It does not connect to the PC.

| Seller | Price | URL |
|---|---|---|
| Rondamo | 8,000 | https://rondamo.co.ke/product/pos-cash-drawer-ech-410-cash-drawer-1k |
| Editech | 10,500 | https://www.editech.co.ke/?p=10469 |
| Potent IT (X-POS BC-410 equivalent, 5 or 4 notes / 8 coins) | 9,425 | https://potent.it.com/product-category/pos-systems/cash-drawers/ |

**Recommended buy price: KES 8,000.**
- A cheaper generic option is the Patam "POS Cash Drawer – 5 Slot, automatic, key lock, RJ11" at KES 4,999 (https://patam.co.ke/shop/pos-office-equipment/cash-drawers/pos-cash-drawer-5-slot/). Its voltage and coin-cup count are not stated.
- Jumia generic 5-bill drawers cost KES 5,999–8,500 (https://www.jumia.co.ke/slp/cash-drawer).
- Use a generic drawer only if price matters more than build quality.

### d. Barcode label printer: **Xprinter XP-470B (4-inch direct thermal, USB)**
- **Why this one.** It is a direct thermal printer, so it needs no ribbon, which suits SMEs. It handles small price and barcode stickers up to 4-inch courier labels (100×150), so one model covers both shops and e-commerce sellers. It is stocked by three Kenyan sellers, including Jumia, and works with the Windows driver and TSPL.
- **Key specs.** 203 dpi, up to 152 mm/s, automatic label (gap) detection, USB (some variants add LAN).
- **Connection.** USB.

| Seller | Price | URL |
|---|---|---|
| Jumia (sold by Jumia, 4.7★ for the XP-420B sister listing) | 12,580 | https://www.jumia.co.ke/slp/xprinter-barcode-printer |
| Onside Tech | 12,499 ex VAT | https://www.onsidetechsolutions.co.ke/?p=22856 |
| Rondamo | 15,500 | https://rondamo.co.ke/product/xprinter-xp-470b-barcode-printer-1t |

**Recommended buy price: about KES 12,600.**
- The cheapest alternative is the 3-inch Xprinter XP-370B at KES 9,500 from Patam (https://patam.co.ke/shop/computing-products-accessories/printers/xprinter-xp-370b). Only one seller with a visible price was found. Jumia lists an "XB-370B" at 13,999.
- The XP-420B costs KES 12,039 on Jumia but was sold out.

**Labels:** use **40 × 30 mm direct thermal, about 700 labels per roll**.

| Seller | Price | URL |
|---|---|---|
| Skywave (40×30 mm, 700 per roll) | 700 | https://skywave.co.ke/label-barcode-adhesive-stickers-roll-50mmx30mmx700pc |
| Patam (40×20 mm, 1,000 per roll) | 799 | https://patam.co.ke/shop/pos-office-equipment/thermal-printers/direct-thermal-barcode-labels-roll-sticker-40x20mm-1000-labels/ |
| Patam (50×25 mm, 1,000 per roll) | 1,050 | same Patam page |
| Rapidtech (57×32 mm, 1,000 per roll) | 1,500 ex VAT | https://rapidtech.co.ke/thermal-rolls-ribbons |

**Budget KES 700–1,000 per roll.**

### e. Computer: **Refurbished HP EliteBook 840 G5 (Core i5 8th gen, 8GB, 256GB SSD, 14" FHD)**

How the three options compare:

| Option | Typical price | Verdict |
|---|---|---|
| **Refurbished EliteBook 840 G5 i5-8th / 8GB / 256GB** | 28,500–35,000 | **Pick.** The built-in battery rides through KPLC blips, the screen and keyboard are included, and the 8th-gen CPU is officially Windows 11-supported. It is portable for owner back-office use, and parts are easy to get in Nairobi. |
| Refurbished mini PC (HP EliteDesk 800 G3 mini, i5-6th gen / 8GB / 256GB SSD) plus a 19–22" monitor and keyboard/mouse | 17,000 (Jumia, My Tech Hub, 6-month warranty, new seller with no ratings: https://www.jumia.co.ke/hp-elitedesk-800-g3-refurbished-mini-desktop-intel-core-i5-6th-gen-3.2ghz-8gb-ram-256gb-ssd-325843378.html) + about 6,900–10,000 for a refurbished monitor (Jumia, e.g. HP EliteDisplay E231 23" at 6,899) + about 1,000 for keyboard/mouse ≈ **25,000–28,000** | Similar cost but no battery, so it needs a UPS. The 6th-gen CPU is not on the Windows 11 supported list. There are more parts to support. |
| All-in-one touch POS terminal | Budget Chinese AIO: Syble XB-S82 single screen (i5-4200U, 8GB, 256GB, 15.6" touch): **52,000 at Rondamo, 56,500 at Editech** (https://www.editech.co.ke/?p=10457). Techlion's unbranded "All-in-One Touchscreen POS" is 27,500, specs not published (https://techlion.co.ke/shop/). Brand AIOs: X-POS EC-T4 i3-8th 15" at 116,000 (Potent, https://potent.it.com/?p=14988); Posiflex PS-3416E at 130,000 ex VAT (Rapidtech); Posiflex PS-3616G2 at 149,000 (Jumia) | **Upgrade reference only.** Touch looks professional, but it costs 2–4 times as much, and the cheap AIOs use old 4th-gen CPUs. |

Kenyan sellers for the pick (EliteBook 840 G5, i5 8th gen, 8GB / 256GB SSD):

| Seller | Price | Warranty | URL |
|---|---|---|---|
| Lapsol | 28,500 ex VAT (≈33,060 incl.) | not stated | https://lapsol.ke/product/hp-elitebook-840-g5-core-i5-8th-gen-8gb-ram-256gb-ssd |
| Potent IT (touchscreen variant) | 32,400 | 6 months | https://potent.it.com/?p=14168 |
| Jumia (Digital Link Computers, 100% seller score, 3.4★ from 11 ratings) | 35,000 | 6 months | https://www.jumia.co.ke/hp-refurblished-elitebook-840-g5-8th-gen-core-i5-8gb-ram-256gb-ssd-windows-11-14-silver-6-months-wrty-319359853.html |
| Kenyatronics | 39,995 | 1 year | https://kenyatronics.com/view-product/hp-elitebook-840-g5-laptop-intel-core-i7-180-ghz-8gb-ram-256gb-ssd-windows-10-pro-refurbished |

**Recommended buy price: about KES 32,000**, with at least a 6-month warranty. Insist on a battery health check. Kenyatronics also lists a ThinkPad T470s i5-7th / 8 / 256 at 34,995 and a Dell Latitude E7480 at 34,995. These are not cheaper and are older.

### f. Consumables and power

**Thermal receipt paper, 80 × 80 mm (79 × 80 × 13 mm core)**

| Seller | Price | URL |
|---|---|---|
| Homelink (carton of about 50 rolls) | 5,999 (≈120 per roll) | https://homelink.co.ke/catalogue/thermal-rolls-size-79mm-x-80mm-x-13mm_1175 |
| Rapidtech (carton of 50) | 6,999 ex VAT (≈162 per roll incl.) | https://rapidtech.co.ke/thermal-rolls-ribbons |
| Rapidtech (single roll) | 300 ex VAT | same Rapidtech page |
| Rondamo (single roll, 60–80 m) | 240 | https://rondamo.co.ke/product/thermal-paper-roll-80mm-x-80mm-9x |

**Buy by the carton at about KES 6,000–7,000.** Include 10 rolls in the starter bundle, which costs about KES 1,300 at carton rates.

**UPS: Mercury Elite 650 Pro (650VA / 390W)**

| Seller | Price | URL |
|---|---|---|
| TDK | 6,200 ex VAT (7,192 incl.) | https://www.tdk.co.ke/?p=53613 |
| Rapidtech | 6,500 ex VAT (≈7,540 incl.); KES 500 delivery | https://rapidtech.co.ke/mercury-elite-650-pro-offline-ups-uk-plug-650va-390w |
| Rondamo (alternative: Mecer ME-650-VU, line-interactive with AVR) | 8,000 | https://rondamo.co.ke/product/mecer-650va-line-interactive-ups-me-6-10w |

**Do you need a UPS?**
- **With the laptop pick it is optional but recommended.** The laptop's battery protects the sale in progress. Without a UPS, though, the receipt printer and drawer stop during a power cut.
- A 650VA UPS keeps the printer (and router) running for about 10–20 minutes. That is enough to finish the queue, and it also protects equipment from surges.
- **With a mini PC or AIO, a UPS is required.**
- Sell it as an add-on at about KES 9,000.

### g. Optional "Mobile / Mini" kit (kiosks, mama mboga, market stalls)

| Item | Pick | Price | Sellers |
|---|---|---|---|
| Tablet | Samsung Galaxy Tab A9 8.7" (4GB/64GB, LTE) | 16,500 at Starmac (https://www.starmac.co.ke/samsung-galaxy-tab-a9-price-kenya/; "prices exclude VAT unless stated"); 21,000 at Phones & Tablets (out of stock) (https://www.phonestablets.co.ke/product/samsung-galaxy-tab-a9/) | Buy at about 17,000–19,000 |
| Bluetooth 58mm printer | Portable 58mm Bluetooth 4.0 + USB mobile receipt printer (Editech SKU 58P1; same class as the "P58") | 5,500 at Editech (https://www.editech.co.ke/?p=10474); 5,500 at Rondamo P58 (https://rondamo.co.ke/product/p58-bluetooth-thermal-receipt-printer-6e); Homelink Xprinter 58mm BT at 3,000 ex VAT, out of stock (https://homelink.co.ke/product/xprinter-58m-bluetooth-thermal-receipt-printer-kra-approved/) | Buy at about 5,500 |

Kit hardware cost is about **KES 22,000–24,500**. The phone camera can scan barcodes, so no scanner is needed.

**Technical caveat for a Chrome PWA on Android.**
- Chrome's Web Bluetooth only talks to **BLE (GATT)** devices. Many cheap 58mm printers are Bluetooth Classic (SPP) only.
- **Test before buying in bulk.** Either choose a dual-mode BLE printer, or print through a bridge app such as RawBT, which installs as an Android print service.
- WebUSB and Web Serial are not available, or are limited, in Android Chrome.

An alternative all-in-one is the Android 13 handheld POS with a built-in 58mm printer and scanner, sold by Rapidtech as "KRA eTIMS ETR approved", at KES 25,500 ex VAT (https://rapidtech.co.ke/kra-e-tims-etr-approved-android-handheld-pos/).

---

## 2. Installation, setup labour and delivery

- **Market rates (secondary source, a vendor blog):**
  - Installation and configuration: **KES 10,000–30,000**
  - Staff training: **KES 5,000–15,000**
  - These figures are attributed to Modern Age Solutions and NIDS in a Veira-authored guide, Feb 2026 (https://dev.to/veira_59608bdb2de0135bea1/how-much-does-a-pos-system-cost-in-kenya-2026-guide-2hbn). The author sells a competing POS.
- **Competitors that include it free:**
  - Nexa offers free installation in Nairobi with its hardware bundles, and free setup on its Starter and Business plans (https://nexaui-tech.pages.dev/pos/price-kenya).
  - Techlion advertises on-site installation and training, with no price shown.
  - RoyalPOS does remote, same-day setup.
- **Delivery:**
  - Rapidtech charges a flat KES 500 for standard packages.
  - Jumia charges KES 170 for pickup or KES 290 for door delivery (seen on the EliteDesk listing).
  - Nairobi courier or boda delivery typically costs KES 300–600. **This is an estimate.**
- **Suggestion for Pentarch (estimate):** charge **KES 5,000** for on-site install, product upload support and one-hour cashier training within Nairobi. Upcountry would be KES 5,000 plus travel at cost. Remote setup for "software only" clients would be KES 2,500–3,500.

---

## 3. Competitors (Kenya)

| Product | Model | Published price | Advertised features | Trial | Source |
|---|---|---|---|---|---|
| **Techlion POS** (Techlion Technologies, Nairobi) | Subscription **or** one-off licence | **Subscription:** Basic KES 50/day; Standard KES 1,200/month ("most popular"); Premium KES 12,000/year. All include unlimited branches, users and products, plus 24/7 support. **One-off:** Offline POS KES 35,000 (single PC, data local, no multi-branch); Online POS KES 35,000 + about KES 5,000/year domain and hosting (cloud, multi-branch, unlimited users, M-Pesa). "Lipa mdogo mdogo" (pay in instalments) is offered. | Web-based; works offline and syncs. M-Pesa **STK Push** with auto-confirmation and refunds/reversals (activation via customer care). Multi-store with stock transfers. Low-stock alerts, barcode/SKU, suppliers and purchase orders, roles (cashier/manager/admin), audit trail, Excel/PDF reports, variants (size/colour), gift cards. Targets retail, hardware, wines & spirits, pharmacy, electronics, salons. On-site install and training in English or Kiswahili. **No eTIMS claim found, and Techlion is not on KRA's approved-integrator list (Jan 2026).** | "Free trial", length not stated | https://techlion.co.ke/pricing/ ; https://pos.techlion.co.ke/ ; https://techlion.co.ke/point-of-salepos/ |
| Techlion hardware shop | Hardware à la carte | AIO touchscreen POS 27,500; barcode scanner 6,000; thermal receipt printer USB/Ethernet 6,500; Wi-Fi dongle 1,000. No packaged bundle price was published. | | | https://techlion.co.ke/shop/ |
| **Uzapoint** | SaaS packages Gold / Platinum / Diamond (Diamond is multi-branch) | **No public prices.** It is quote-only, with "free onboarding" according to a third party. | eTIMS described as "live" via KRA; mobile money till/paybill with automatic reconciliation; separate UP Hotelier app; Android handheld and Windows AIO hardware bundles (price on enquiry). Offline not mentioned. Not on KRA's Jan 2026 integrator list under that name. | "Start Free Trial", length not stated | https://uzapoint.com/ |
| **Jampos** | Monthly SaaS, priced in USD | Rafiki **$9.5**/month (≈KES 1,230); Jambo **$29.5**/month (≈KES 3,800); Custom **$49.5**/month (≈KES 6,400). FX at about 129 is an estimate. | Free M-Pesa integration, barcode app, QR menu and QR Wi-Fi on all plans. QuickTill Desktop is a free 100% offline POS for Windows and macOS. Restaurant/hotel POS. "Cancel anytime, no contracts." eTIMS not stated. | Free trial, length not stated | https://jampos.app/pricing |
| **SimbaPOS** (Simba Web Experts) | One-off licence | From **US$249 per user, one-time** (Capterra). No KES price list published. | Restaurant POS (order tokens, kitchen printing), M-Pesa, shift reports, loyalty, commissions, customer accounts. "Offline-first Depot POS & ERP" mobile app. eTIMS not stated. | Free trial available (Capterra) | https://www.capterra.com/p/178629/SimbaPOS/ ; https://simbapos.com/ |
| **Loyverse** | Free core plus paid add-ons (USD, per store) | Free: POS, 31-day analytics, essential inventory, loyalty, customer display, kitchen display, multi-store, integrations. Add-ons: Unlimited history $7/month ($70/year); Employee management $25/month ($250/year); Advanced inventory $25/month ($250/year). | No M-Pesa STK or eTIMS natively (local workarounds only). **Not on KRA's integrator list.** | 14 days per add-on, no card | https://loyverse.com/pricing |
| **Odoo POS** | Per user per month, USD (Sub-Saharan Africa tier) | Standard $8.95/user/month (yearly) or $11.20 (monthly), "1 app free"; Custom $13.60 / $17.00. Updated 18 Oct 2026. Implementation is extra. | Full ERP. eTIMS via approved Kenyan partners: Odoo KE Ltd, Innovus, Serpentcs are on KRA's list (OSCU/VSCU). M-Pesa via partner modules. | Free "One App" | https://oec.sh/odoo-pricing/kenya |
| **RoyalPOS** (Swiftomatics, India) | "Simple yearly subscription per outlet", price via WhatsApp | Not published | Restaurant focus: KOT, tables, split bills, KDS, QR menu. Offline billing with cloud sync. Remote same-day setup. M-Pesa and eTIMS not mentioned. | Free live demo | https://royalpos.in/pos-software-in-kenya |
| **Nexa POS** (Nexaui Tech) | One-off licence; optional cloud | Starter KES 9,500; Business KES 15,000; Multi-branch 25,000+. Bundles: Basic (software + printer + scanner) KES 45,000; Standard Retail KES 60,000; Restaurant 75,000+. Free Nairobi installation. | M-Pesa; offline with sync; cards on Business plan. eTIMS not stated. | Not stated | https://nexaui-tech.pages.dev/pos/price-kenya |
| **Veira** | Revenue share | 1.5% of monthly revenue with "free hardware" (vendor's own blog); elsewhere "from KES 2,500/month single store"; mobile POS KES 18,000. | Offline-first, M-Pesa, bulk SMS, claims eTIMS | 15-minute demo; 30-day refund on onboarding fee | dev.to/veira_* articles (vendor marketing) |
| **Pesapal** | Free software; buy terminal; card fees | Terminals SP600/SP630 KES 10,000; SP830/N910 KES 12,000 (Jul 2025) | Card + mobile money, Android N910 with built-in printer and scanner. PesaPal Ltd **is** on KRA's integrator list (forecourt and Oracle Hospitality products). | | https://www.pesapal.com/blog/pos-machine-price |

**Not found or not verifiable:**
- **Posbytz:** no Kenya pricing found.
- **"Sasa POS" and "Maly":** no Kenyan product found.
- **"Hesabu/Duka"-type apps:** only low-quality, unverifiable free-POS landing pages (e.g. dakasale, SokoniPOS) with no stable pricing.
- **Vend/Lightspeed, Square, Toast, Shopify POS:** no Kenyan local presence or KES pricing. They are used only as feature benchmarks in section 6.
- **Zoho:** Zoho Software Solutions is on KRA's integrator list as "Zoho Online", meaning Zoho Books/Invoice. Zoho POS pricing in Kenya was not checked.

**What the market price bands are:**
- Cheap SaaS sits at **KES 1,000–1,300/month** (Techlion KES 12,000/year; Jampos Rafiki about KES 1,230).
- Mid-tier SaaS sits at **KES 2,500–4,000/month**.
- One-off licences run **KES 9,500–35,000**.
- Bundles with printer and scanner but **no computer** run **KES 45,000–60,000** (Nexa).
- **eTIMS integration is the weakest point among the cheap local players.** None of Techlion, Uzapoint (by that name), SimbaPOS, Jampos or Loyverse appear on KRA's approved-integrator list dated 26 Jan 2026. That makes eTIMS a real differentiator for Pentarch if certified.

---

## 4. KRA eTIMS: what applies in 2026

**Who must comply**
- **Every person carrying on business must issue eTIMS invoices**, VAT-registered or not. Counter sales are included.
- From **1 Jan 2026**, KRA validates income and expenses in income tax returns against eTIMS/TIMS data. Expenses not backed by a valid, transmitted eTIMS invoice (with the buyer's PIN where applicable) are disallowed.
- M-Pesa messages are proof of payment, **not** tax invoices.
- Non-compliance is an offence. The penalty is cited as twice the tax due.
- If an eTIMS system fails, KRA must be notified in writing within 24 hours.

Sources: https://hapakenya.com/2026/01/23/understanding-etims-a-guide-to-kenyas-electronic-tax-invoice-management-system/ and https://techbullion.com/kra-etims-at-the-till-what-a-kenyan-duka-chemist-or-mini-mart-must-do-in-2026/

**Solution types**

| Solution | Who it is for |
|---|---|
| eTIMS Lite (web, app, USSD *222#) | Non-VAT, low volume, manual entry |
| eTIMS Client (Windows) | Works offline, one device per PIN. Goods sellers need the Windows client; the Android client is for services. |
| Online portal | Services only, about 10 invoices a month |
| **OSCU (Online Sales Control Unit)** | System-to-system API. Every invoice is signed online. For businesses that are always connected. |
| **VSCU (Virtual Sales Control Unit)** | System-to-system. A local virtual control unit signs invoices and can batch and sync when offline. For high volume or intermittent connectivity. |
| Buyer-initiated invoicing | For buying from small suppliers (up to KES 5M turnover) |

KRA itself does not charge for any of these. Integrators may charge.

Sources: https://www.kra.go.ke/business/etims-electronic-tax-invoice-management-system/learn-about-etims/etims-system-to-system-integration ; techbullion (above)

**Do POS vendors integrate?**
- Yes, through OSCU or VSCU. They can be KRA-approved third-party integrators, or the taxpayer can self-integrate.
- KRA's list of approved integrators **as at 26 Jan 2026 has 53 firms**, each with an OSCU and/or VSCU type: https://www.kra.go.ke/images/publications/List-of-Approved-eTIMS-3rd-party-integrators-as-at-26th-January-2026.pdf
- The process is:
  1. Read the OSCU/VSCU spec v2.0 and the Trader Invoicing System technical spec v2.0.
  2. Register in KRA's eTIMS **sandbox**.
  3. Develop and test in the sandbox.
  4. Go through vetting and certification.
  5. Submit the third-party bio data and documents through etims.kra.go.ke.
- The OSCU/VSCU bio-data form is at https://www.kra.go.ke/images/publications/eTIMS-Bio-Data-Form-for-OSCU-and-VSCU.pdf

**What Pentarch POS must do to be eTIMS-ready in 2026**

The first four items come from the techbullion article and KRA. The remaining items follow the OSCU spec; **verify them against spec v2.0 before building.**

1. Be on KRA's approved list, either as Pentarch being certified as an integrator or by partnering with a listed integrator. Each client needs its own device/branch registration (initialisation with PIN, branch ID and device serial).
2. Send **every sale** to KRA, so that each one gets a signed receipt back.
3. Handle **returns as credit notes** linked to the original invoice number.
4. Keep **stock in and out** in the same system: purchases add stock and sales reduce it. KRA expects stock-movement records, though no compliance date has been set. Offer a monthly invoice export so the client can reconcile with iTax.
5. Register each item with its KRA item classification code, packaging-unit and quantity-unit codes, and tax type: **A** exempt, **B** 16% VAT, **C** 0%, **D** non-VAT, **E** 8% (per the OSCU spec).
6. Allow the buyer's PIN to be captured, since B2B customers need it to claim expenses.
7. Print the receipt with:
   - seller PIN and buyer PIN (if given)
   - item codes and tax breakdown by band
   - the **control unit (CU) serial and CU invoice number**
   - internal data and receipt signature
   - date and time
   - a **QR code** that can be checked on KRA's invoice checker

**Architecture note for an offline-first PWA.**
- OSCU needs connectivity for each invoice. Invoices queued offline would only be fiscalised later.
- VSCU tolerates offline, but it runs as a local service, so a pure browser PWA cannot host it.
- Practical options:
  - **Pentarch cloud acts as the OSCU client.** The PWA syncs the sale, the cloud signs it with KRA and sends back the CU number and QR, and the till prints or reprints the fiscal receipt. While offline, print a "pending fiscalisation" slip.
  - A small Windows companion service hosts VSCU locally.
- Decide this early. It shapes the sync design.

---

## 5. M-Pesa for the POS

**Lipa Na M-Pesa Buy Goods (Till) costs to the SME**
- The customer pays nothing.
- The merchant tariff from **7 Aug 2026** (https://tech-ish.com/2026/08/01/mpesa-pochi-buy-goods-tariff-cuts-2026/) is:

| Payment amount | Merchant fee |
|---|---|
| KES 0–500 | free |
| KES 501–36,363 | **0.55%** |
| Above 36,363 | capped at **KES 200** |

- paybillke (verified 1 Sep 2026) still quotes the free threshold as KES 200, so treat KES 500 as the latest figure and recheck Safaricom's tariff page: https://paybillke.com/guides/mpesa-till-charges-business-2026
- Settlement to bank costs about KES 0–100 per settlement, depending on the bank and the settlement frequency.
- **Till registration:** Safaricom does not charge an application fee. A business till needs the KRA PIN, owner ID, and a business registration certificate or permit. This is my general knowledge and was not verified on a 2026 page.
- Aggregators add roughly 1–3% on top of Safaricom's fees. Direct Daraja integration avoids this (paybillke, Sep 2026).

**Daraja basics for a POS.** The Daraja APIs are free to use. Developer account: developer.safaricom.co.ke.

- **STK Push (Lipa na M-Pesa Online).** The cashier enters the customer's phone number and the customer gets a PIN prompt.
  - For a **till**: BusinessShortCode = the Head Office/**Store number**, PartyB = the **Till number**, TransactionType = `CustomerBuyGoodsOnline`.
  - For a paybill: use `CustomerPayBillOnline` with shortcode = paybill.
  - It needs the go-live **passkey**, a **public HTTPS CallBackURL**, and STK Query (transaction status) for timeouts.
- **C2B Register URL.** This captures payments that customers make manually to the till or paybill, by registering **Validation** and **Confirmation** URLs. Validation is optional and must be enabled by Safaricom. The POS can then list "unmatched M-Pesa payments received" for the cashier to attach to a sale, which is valuable when customers pay before the cashier asks.
- **Go-live.** The business owner (as M-Pesa Org Portal admin) approves go-live for their shortcode on the Daraja portal. The passkey and credentials are issued per shortcode, so **each client till needs its own go-live**. Pentarch's cloud should hold per-tenant credentials and one multi-tenant callback endpoint.
- **Online requirement.** STK Push and callbacks need internet and a server, so this cannot work from an offline PWA alone. When offline, fall back to "customer pays to till, cashier enters the M-Pesa code", then reconcile with C2B data after sync.
- **B2C** (refunds and payouts) needs extra Safaricom approval and an initiator credential. Treat it as a later feature.
- **Pochi la Biashara** has no Daraja API to my knowledge. Recommend that clients use a proper till.

Sources: https://mctaba.com/kb/daraja-c2b-b2c-b2b ; https://paybillke.com/guides/mpesa-pos-integration-kenya-2026 ; https://pos.techlion.co.ke/ (shows a competitor offering STK Push with refunds)

---

## 6. Feature checklist (deduplicated)

Benchmarks: Loyverse, Square, Lightspeed, Shopify POS, Odoo POS, Uzapoint, Techlion and Toast. **★ = differentiator in the Kenyan SME market**, meaning cheap local competitors usually lack it or do it poorly.

**Selling / checkout**
- Fast product grid and search, barcode scan, quick keys and favourites, custom (open-price) item
- Quantity, price override with permission, line and cart discounts (% / amount), promo codes
- Hold or park sale and resume; multiple open tickets
- Split tender (cash + M-Pesa + card), change calculation, rounding
- Returns and refunds against the original receipt; exchanges
- Receipt reprint, SMS/WhatsApp/email e-receipt ★, custom header/footer and logo
- Tax-inclusive or exclusive pricing; multiple tax bands (16%, 0%, exempt, 8%)
- ★ **M-Pesa STK Push from the till**, plus C2B auto-matching of till payments and an M-Pesa code lookup
- ★ **eTIMS fiscal receipt (CU number and QR) on every sale; credit notes**
- Customer-facing display (second screen or tablet)
- Keyboard-only operation for speed; touch mode

**Inventory**
- Products with variants (size/colour), SKU, multiple barcodes, units of measure
- Stock levels, low-stock alerts, reorder points
- Stock adjustments with reasons (damage, expiry, theft), stock takes / cycle counts with a variance report
- Cost tracking (average or FIFO), margin per item
- Bulk import/export by Excel/CSV ★ (onboarding speed matters)
- Barcode label printing from the POS ★
- Composite items and recipes/BOM (ingredients deducted), bundles/kits
- Batch/lot and **expiry tracking** (pharmacy, food) ★
- Serial/IMEI tracking (electronics, phones) ★

**Purchasing / suppliers**
- Supplier list, purchase orders, receiving (GRN), partial receipts
- Supplier credit and payables, supplier payments
- Landed cost / cost update on receipt
- ★ eTIMS purchase records (stock-in from supplier invoices, buyer-initiated invoices)

**Customers, credit and loyalty**
- Customer profiles, purchase history, buyer KRA PIN ★
- ★ **Credit sales / "deni" book** with limits, statements, partial payments and SMS reminders. This is very valued in Kenya.
- Loyalty points or stamps, store credit, gift cards/vouchers
- Customer groups and price lists
- Bulk SMS / WhatsApp marketing ★

**Staff**
- User accounts with PIN login, roles and permissions (void, discount, refund, price change, open drawer)
- Shift clock-in/out, sales by staff, commissions (salon, sales agents)
- Audit log of sensitive actions ★ (anti-theft)

**Cash management**
- Open and close shift with float, cash in/out (expenses, drops), X/Z reports
- Expected vs counted cash per tender (cash / M-Pesa / card) and variance ★
- Drawer opens only on cash sales or with permission; "no sale" logged
- Daily expense recording (petty cash)

**Reports**
- Sales by day/hour/item/category/staff/payment type/branch
- Profit and gross margin, top and slow movers, dead stock
- Stock valuation, stock movement history
- Tax (VAT) report, eTIMS reconciliation export ★
- Debtors (credit) ageing ★
- Owner mobile dashboard and daily WhatsApp/SMS summary ★
- Export to Excel/PDF; accounting export (QuickBooks, Xero, Tally, Sage)

**Restaurant / bar (Toast and Loyverse benchmarks)**
- Tables and floor plan, open tabs, waiter assignment
- Modifiers and notes, courses, kitchen order tickets to a kitchen printer or KDS
- Split or merge bills, service charge, tips
- Recipe/ingredient stock deduction, happy-hour pricing
- QR menu / table ordering ★; takeaway and delivery orders

**Salon / services**
- Service items with duration, stylist assignment and commission
- Appointments/bookings with SMS reminders ★
- Service plus product sale on one bill; packages/memberships

**Pharmacy**
- Batch and expiry with FEFO picking and expiry alerts ★
- Generic/brand search, dosage units (tablet / strip / box) ★
- Prescription notes, patient record, controlled-item logs
- Insurance or corporate credit billing (later)

**Hardware store**
- Sell by multiple units (piece/box/metre/kg), fractional quantities
- Quotations and proforma invoices converted to sales ★
- Delivery notes, contractor credit accounts

**Boutique / fashion**
- Size and colour matrix variants, label printing per variant
- Exchanges, lay-by (lipa pole pole / instalments) ★, seasonal markdowns

**Butchery / weighed goods**
- Price per kg with decimal quantity, price-embedded EAN-13 barcodes (2x prefix) from scale labels ★
- Optional serial scale integration (later)

**Wholesale / distribution**
- Tiered and volume pricing, customer-group price lists (retail vs wholesale) ★
- Minimum quantities, pack/carton breakdown (sell carton or piece) ★
- Invoices with buyer PIN, route sales / van stock (later)

**Multi-branch**
- Central product catalogue with per-branch price and stock
- Inter-branch stock transfers with in-transit status
- Consolidated and per-branch reports, per-branch users
- Central purchasing (later)

**Offline and reliability**
- ★ **True offline selling** (PWA plus local DB), queued sync, conflict handling
- Offline M-Pesa fallback (manual code entry, then reconciliation)
- Automatic cloud backup, multi-device sync, sync status indicator
- Works on old hardware and low bandwidth ★

**Integrations**
- M-Pesa Daraja (STK, C2B, B2C refunds) ★
- KRA eTIMS OSCU/VSCU ★
- Card terminals (Pesapal, Equity, KCB)
- Bulk SMS (Africa's Talking etc.), WhatsApp Business
- Accounting (QuickBooks, Xero, Odoo)
- E-commerce and online store sync (WooCommerce, Shopify)
- Open API / webhooks

**Platform / commercial**
- Kiswahili UI ★, KES formatting
- Free trial, low monthly price, M-Pesa subscription payment ★
- Local on-site support and training ★

---

## FINAL PICKS

| Item | Model | Recommended buy price (KES) | Seller (URL) |
|---|---|---|---|
| Computer | HP EliteBook 840 G5, i5-8th gen, 8GB, 256GB SSD (refurb) | 32,000 (seen at 28,500 ex VAT – 35,000) | Potent IT: https://potent.it.com/?p=14168 (32,400, 6-month warranty) / Lapsol: https://lapsol.ke/product/hp-elitebook-840-g5-core-i5-8th-gen-8gb-ram-256gb-ssd |
| Barcode scanner | Syble XB-6255M 2D wired USB | 4,000 | Almiria: https://almiria.co.ke/catalogue/syble-xb-6255m-2d-barcode-scanner_2364 (3,500 ex VAT) |
| Receipt printer | Xprinter XP-Q80A 80mm, USB + LAN, auto-cutter, RJ11 24V drawer port | 8,000 | Onside Tech: https://www.onsidetechsolutions.co.ke/?p=20772 (7,500 ex VAT) |
| Cash drawer | EPOS ECH-410, 5 bill / 8 coin, RJ11, 12/24V | 8,000 | Rondamo: https://rondamo.co.ke/product/pos-cash-drawer-ech-410-cash-drawer-1k |
| Label printer (optional) | Xprinter XP-470B 4" direct thermal, USB | 12,600 | Jumia: https://www.jumia.co.ke/slp/xprinter-barcode-printer (12,580) / Onside: https://www.onsidetechsolutions.co.ke/?p=22856 |
| Labels | 40×30 mm direct thermal, 700 per roll | 700 per roll | Skywave: https://skywave.co.ke/label-barcode-adhesive-stickers-roll-50mmx30mmx700pc |
| Receipt paper | 80×80 mm thermal, carton of about 50 | 6,000 per carton (≈120 per roll) | Homelink: https://homelink.co.ke/catalogue/thermal-rolls-size-79mm-x-80mm-x-13mm_1175 |
| UPS (optional, recommended) | Mercury Elite 650 Pro 650VA | 7,200 | TDK: https://www.tdk.co.ke/?p=53613 (6,200 ex VAT) |
| Mobile kit tablet | Samsung Galaxy Tab A9 LTE 4/64 | 17,000–19,000 | Starmac: https://www.starmac.co.ke/samsung-galaxy-tab-a9-price-kenya/ |
| Mobile kit printer | Portable 58mm Bluetooth 4.0 + USB (BLE must be verified) | 5,500 | Editech: https://www.editech.co.ke/?p=10474 |
| Upgrade reference only | Syble XB-S82 15.6" touch AIO (i5-4200U, 8/256) | 52,000–56,500 | Rondamo / Editech: https://www.editech.co.ke/?p=10457 |

---

## Proposed Pentarch pricing (ESTIMATES: proposals, not market data)

### (a) Starter Till Bundle

| Component | Pentarch cost | Pentarch sell |
|---|---|---|
| EliteBook 840 G5 i5/8/256 | 32,000 | 40,000 |
| Syble XB-6255M 2D scanner | 4,000 | 5,500 |
| Xprinter XP-Q80A | 8,000 | 10,500 |
| EPOS ECH-410 drawer | 8,000 | 10,500 |
| 10 rolls of 80×80 paper | 1,300 | 2,000 |
| **Hardware subtotal** | **53,300** | **68,500** (≈28.5% markup / 22% gross margin) |
| On-site setup, product upload help, training, Nairobi delivery | about 2,000 (staff time and transport) | 5,000 |
| Pentarch POS software, year 1 | n/a | 12,000 |
| **Bundle total** | | **≈ KES 85,500 → offer at KES 84,900** |

Notes on the bundle:
- Add-ons: UPS at about +9,000 and label printer kit (XP-470B plus 5 label rolls) at about +19,500.
- To reach about 30% gross margin on hardware, price the bundle at about KES 92,000. That is still competitive, because Nexa charges KES 45,000–60,000 for software plus printer and scanner **without a computer**, and a Syble AIO alone costs 52,000–56,500.
- **Confirm whether Pentarch is VAT-registered.** Source prices mix ex-VAT and VAT-inclusive figures, and these proposals assume VAT-inclusive buying.

### (b) Software + setup only (client uses their own Windows PC and Chrome)
- **KES 15,000 one-off**, covering remote or on-site setup, data import and training, plus the **first 12 months** of software.
- Alternatively, **KES 3,500 setup plus monthly billing.**

### Subscription after the free trial (suggest a 14-day trial)
- **KES 1,200/month or KES 12,000/year** for single-branch Standard. This matches Techlion's Standard and Premium plans and sits just under Jampos Rafiki (about KES 1,230).
- **KES 2,000/month "Biashara Pro"**: eTIMS-fiscalised receipts, M-Pesa STK and C2B auto-reconciliation, credit book and SMS. Launch it once KRA certification or an integrator partnership is in place. **eTIMS is the main differentiator against Techlion, Jampos, SimbaPOS and Loyverse, none of which are on KRA's Jan 2026 integrator list.**
- **Each extra branch: +KES 1,000/month.**
- **Mobile/Mini kit:** hardware cost about 22,000–24,500, sell at about KES 29,900 including setup, plus the same subscription.
