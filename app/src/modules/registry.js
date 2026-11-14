// MODULE REGISTRY — the single place to plug in a feature module.
// To add a module: create src/modules/<name>/index.js (see ARCHITECTURE.md) and add ONE line below.
import home from './home/index.js';
import sell from './sell/index.js';
import products from './products/index.js';
import customers from './customers/index.js';
import shifts from './shifts/index.js';
import settings from './settings/index.js';
import help from './help/index.js';
import reports from './reports/index.js';
import expenses from './expenses/index.js';
import inventory from './inventory/index.js';
import purchasing from './purchasing/index.js';
// Phase 2 modules plug in here, e.g.:
// import reports from './reports/index.js';
// import restaurant from './restaurant/index.js';
import restaurant from './restaurant/index.js';
import services from './services/index.js';
import quotes from './quotes/index.js';

export const MODULES = [home, sell, products, customers, shifts, settings, help, inventory, purchasing, reports, expenses, restaurant, services, quotes];
