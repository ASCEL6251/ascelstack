// Workflow specs for the /automation visualisations.
// Coordinates are in a 1000 × 520 viewBox. Businesses and figures are illustrative (TEMP).

export type NodeKind = 'trigger' | 'agent' | 'action' | 'if' | 'tool' | 'report';
export type Layer = 'build' | 'grow' | 'run';

export interface WNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  label: string;
  meta?: string;
  icon: IconName;
  step: number;
  layer?: Layer;
}

export interface WEdge {
  from: string;
  to: string;
  label?: string;
}

export interface Workflow {
  id: string;
  tab: string;
  sector: string;
  title: string;
  body: string;
  stats: { v: string; k: string }[];
  link: { href: string; label: string };
  nodes: WNode[];
  edges: WEdge[];
}

/** 24×24 stroke icons, drawn for this site. */
export const ICONS = {
  chat: 'M4 5h16v11H9l-5 4z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  cart: 'M3 4h2l2.4 10.5h10.2L20 7H6.2M9 19.5h.01M17 19.5h.01',
  spark: 'M12 3v5M12 16v5M3 12h5M16 12h5M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8',
  db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  doc: 'M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4',
  truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19h.01M17 19h.01',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  chart: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
  split: 'M4 12h5l5-6h6M9 12l5 6h6',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  screen: 'M3 5h18v11H3zM8 20h8M12 16v4',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  book: 'M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h6',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  model: 'M8 3h8v4H8zM4 9h16v12H4zM9 14h.01M15 14h.01M9 18h6',
  rupee: 'M6 4h12M6 9h12M6 4c6 0 8 1.5 8 5s-3 5-8 5l8 7',
  check: 'M4 12l5 5L20 6',
  repeat: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
} as const;

export type IconName = keyof typeof ICONS;

export const KIND_INFO: Record<Exclude<NodeKind, 'tool'> | 'tool', { name: string; text: string; icon: IconName }> = {
  trigger: { name: 'Trigger', text: 'An event starts the run: a new order, a message, a due date, a payment.', icon: 'bolt' },
  agent: { name: 'AI agent', text: 'Reads the situation, decides what to do, and uses tools to do it.', icon: 'spark' },
  tool: { name: 'Tool', text: 'What the agent can reach: your data, your rules, a model, a calendar.', icon: 'db' },
  if: { name: 'Decision', text: 'A clear rule splits the path, so exceptions go to a person.', icon: 'split' },
  action: { name: 'Action', text: 'Work gets done in your systems: invoices, messages, stock, records.', icon: 'check' },
  report: { name: 'Report', text: 'Every run lands in a log and a dashboard you can read.', icon: 'chart' },
};

/* -------------------------------------------------------------------------- */

export const orderToCash: Workflow = {
  id: 'order-to-cash',
  tab: 'E-commerce',
  sector: 'D2C brand · 3 marketplaces',
  title: 'Order to cash, without the copy-paste',
  body: 'An order on any channel updates stock everywhere, gets checked by an agent, invoiced, shipped and booked, before anyone opens a laptop.',
  stats: [
    { v: '9 h', k: 'saved / week' },
    { v: '0', k: 're-keyed orders' },
  ],
  link: { href: '/services/ecommerce-marketplaces', label: 'E-commerce services' },
  nodes: [
    { id: 't', kind: 'trigger', x: 80, y: 210, label: 'New order', meta: 'Store · Amazon · Flipkart', icon: 'cart', step: 0, layer: 'grow' },
    { id: 'sync', kind: 'action', x: 230, y: 210, label: 'Sync stock', meta: 'all channels', icon: 'box', step: 1, layer: 'run' },
    { id: 'ag', kind: 'agent', x: 425, y: 210, label: 'Check order', meta: 'AI agent', icon: 'spark', step: 2, layer: 'build' },
    { id: 'k1', kind: 'tool', x: 365, y: 380, label: 'Fraud rules', icon: 'shield', step: 2 },
    { id: 'k2', kind: 'tool', x: 485, y: 380, label: 'Customer history', icon: 'db', step: 2 },
    { id: 'inv', kind: 'action', x: 620, y: 210, label: 'GST invoice', meta: 'auto-numbered', icon: 'doc', step: 3, layer: 'run' },
    { id: 'ship', kind: 'action', x: 770, y: 110, label: 'Book courier', meta: 'label + AWB', icon: 'truck', step: 4, layer: 'run' },
    { id: 'msg', kind: 'action', x: 770, y: 310, label: 'Tell customer', meta: 'WhatsApp', icon: 'chat', step: 4, layer: 'grow' },
    { id: 'rep', kind: 'report', x: 915, y: 210, label: 'Books + dashboard', icon: 'chart', step: 5, layer: 'run' },
  ],
  edges: [
    { from: 't', to: 'sync' },
    { from: 'sync', to: 'ag' },
    { from: 'ag', to: 'k1' },
    { from: 'ag', to: 'k2' },
    { from: 'ag', to: 'inv' },
    { from: 'inv', to: 'ship' },
    { from: 'inv', to: 'msg' },
    { from: 'ship', to: 'rep' },
    { from: 'msg', to: 'rep' },
  ],
};

export const leadFlow: Workflow = {
  id: 'leads',
  tab: 'Sales',
  sector: 'Interior design studio',
  title: 'Every enquiry answered in under a minute',
  body: 'Messages are answered and qualified by an agent, the CRM stays current, and only serious buyers reach the calendar.',
  stats: [
    { v: '< 60 s', k: 'first reply' },
    { v: '3×', k: 'more calls booked' },
  ],
  link: { href: '/services/ai-automation', label: 'AI & automation services' },
  nodes: [
    { id: 't', kind: 'trigger', x: 80, y: 200, label: 'WhatsApp enquiry', meta: 'or web form', icon: 'chat', step: 0, layer: 'grow' },
    { id: 'ag', kind: 'agent', x: 300, y: 200, label: 'Qualify lead', meta: 'AI agent', icon: 'spark', step: 1, layer: 'build' },
    { id: 'k1', kind: 'tool', x: 210, y: 380, label: 'Language model', icon: 'model', step: 1 },
    { id: 'k2', kind: 'tool', x: 300, y: 400, label: 'Price list', icon: 'book', step: 1 },
    { id: 'k3', kind: 'tool', x: 390, y: 380, label: 'Chat memory', icon: 'db', step: 1 },
    { id: 'crm', kind: 'action', x: 510, y: 200, label: 'Update CRM', meta: 'deal + notes', icon: 'user', step: 2, layer: 'run' },
    { id: 'if', kind: 'if', x: 660, y: 200, label: 'Ready to buy?', icon: 'split', step: 3 },
    { id: 'cal', kind: 'action', x: 830, y: 105, label: 'Book a site visit', meta: 'calendar', icon: 'calendar', step: 4, layer: 'run' },
    { id: 'nur', kind: 'action', x: 830, y: 300, label: 'Nurture sequence', meta: 'email · 14 days', icon: 'mail', step: 4, layer: 'grow' },
  ],
  edges: [
    { from: 't', to: 'ag' },
    { from: 'ag', to: 'k1' },
    { from: 'ag', to: 'k2' },
    { from: 'ag', to: 'k3' },
    { from: 'ag', to: 'crm' },
    { from: 'crm', to: 'if' },
    { from: 'if', to: 'cal', label: 'yes' },
    { from: 'if', to: 'nur', label: 'not yet' },
  ],
};

export const restaurantFlow: Workflow = {
  id: 'restaurant',
  tab: 'Restaurant',
  sector: 'Two-outlet café',
  title: 'Service runs itself between the pass and the supplier',
  body: 'Aggregator orders land on the kitchen screen, stock is deducted per recipe, suppliers are pinged before you run out, and reviews get a reply.',
  stats: [
    { v: '0', k: 'missed orders' },
    { v: '4.6 → 4.8', k: 'avg. rating' },
  ],
  link: { href: '/services/restaurant-food', label: 'Restaurant services' },
  nodes: [
    { id: 't', kind: 'trigger', x: 80, y: 200, label: 'Aggregator order', meta: 'Swiggy · Zomato', icon: 'bell', step: 0, layer: 'grow' },
    { id: 'kds', kind: 'action', x: 230, y: 200, label: 'Kitchen screen', meta: 'by station', icon: 'screen', step: 1, layer: 'run' },
    { id: 'inv', kind: 'action', x: 380, y: 200, label: 'Deduct stock', meta: 'per recipe', icon: 'box', step: 2, layer: 'run' },
    { id: 'if', kind: 'if', x: 530, y: 200, label: 'Running low?', icon: 'split', step: 3 },
    { id: 'po', kind: 'action', x: 690, y: 95, label: 'Reorder', meta: 'supplier · WhatsApp', icon: 'truck', step: 4, layer: 'run' },
    { id: 'ag', kind: 'agent', x: 720, y: 300, label: 'Review replies', meta: 'AI agent', icon: 'spark', step: 4, layer: 'build' },
    { id: 'k1', kind: 'tool', x: 660, y: 455, label: 'Brand voice', icon: 'book', step: 4 },
    { id: 'k2', kind: 'tool', x: 780, y: 455, label: 'Review sites', icon: 'star', step: 4 },
    { id: 'rep', kind: 'report', x: 915, y: 200, label: 'Daily P&L', meta: 'food cost %', icon: 'rupee', step: 5, layer: 'run' },
  ],
  edges: [
    { from: 't', to: 'kds' },
    { from: 'kds', to: 'inv' },
    { from: 'inv', to: 'if' },
    { from: 'if', to: 'po', label: 'yes' },
    { from: 'if', to: 'ag', label: 'no' },
    { from: 'ag', to: 'k1' },
    { from: 'ag', to: 'k2' },
    { from: 'po', to: 'rep' },
    { from: 'ag', to: 'rep' },
  ],
};

export const complianceFlow: Workflow = {
  id: 'compliance',
  tab: 'Compliance',
  sector: 'Wholesale trader · GST registered',
  title: 'Month-end reconciliation, prepared before the deadline',
  body: 'Sales and purchases are pulled and matched by an agent. Mismatches go to your accountant; a clean draft is ready for their review and filing.',
  stats: [
    { v: '2 days', k: 'earlier every month' },
    { v: '100%', k: 'reviewed by a professional' },
  ],
  link: { href: '/services/registration-compliance', label: 'Compliance services' },
  nodes: [
    { id: 't', kind: 'trigger', x: 80, y: 210, label: 'Month closes', meta: 'schedule', icon: 'clock', step: 0, layer: 'run' },
    { id: 'pull', kind: 'action', x: 230, y: 210, label: 'Pull sales + purchases', meta: 'books · invoices', icon: 'db', step: 1, layer: 'run' },
    { id: 'ag', kind: 'agent', x: 425, y: 210, label: 'Reconcile', meta: 'AI agent', icon: 'spark', step: 2, layer: 'build' },
    { id: 'k1', kind: 'tool', x: 345, y: 385, label: 'Supplier data', icon: 'doc', step: 2 },
    { id: 'k2', kind: 'tool', x: 425, y: 405, label: 'Ledger', icon: 'book', step: 2 },
    { id: 'k3', kind: 'tool', x: 505, y: 385, label: 'Your rules', icon: 'shield', step: 2 },
    { id: 'if', kind: 'if', x: 610, y: 210, label: 'Mismatch?', icon: 'split', step: 3 },
    { id: 'ca', kind: 'action', x: 770, y: 110, label: 'Flag to accountant', meta: 'with evidence', icon: 'user', step: 4, layer: 'run' },
    { id: 'draft', kind: 'action', x: 770, y: 310, label: 'Draft return', meta: 'for review', icon: 'doc', step: 4, layer: 'run' },
    { id: 'rem', kind: 'report', x: 915, y: 210, label: 'Due-date reminders', icon: 'calendar', step: 5, layer: 'run' },
  ],
  edges: [
    { from: 't', to: 'pull' },
    { from: 'pull', to: 'ag' },
    { from: 'ag', to: 'k1' },
    { from: 'ag', to: 'k2' },
    { from: 'ag', to: 'k3' },
    { from: 'ag', to: 'if' },
    { from: 'if', to: 'ca', label: 'yes' },
    { from: 'if', to: 'draft', label: 'no' },
    { from: 'ca', to: 'rem' },
    { from: 'draft', to: 'rem' },
  ],
};

export const supportFlow: Workflow = {
  id: 'support',
  tab: 'Support',
  sector: 'Consumer electronics seller',
  title: 'Calls and chats answered, around the clock',
  body: 'Voice and chat agents answer from your own knowledge base and order data. Anything they cannot solve goes to a person with the full context.',
  stats: [
    { v: '24/7', k: 'coverage' },
    { v: '72%', k: 'solved without a human' },
  ],
  link: { href: '/services/ai-automation', label: 'AI support agents' },
  nodes: [
    { id: 't', kind: 'trigger', x: 80, y: 200, label: 'Call or chat', meta: 'phone · WhatsApp · web', icon: 'phone', step: 0, layer: 'grow' },
    { id: 'ag', kind: 'agent', x: 300, y: 200, label: 'Support agent', meta: 'voice + chat', icon: 'spark', step: 1, layer: 'build' },
    { id: 'k1', kind: 'tool', x: 210, y: 380, label: 'Knowledge base', icon: 'book', step: 1 },
    { id: 'k2', kind: 'tool', x: 300, y: 400, label: 'Order lookup', icon: 'db', step: 1 },
    { id: 'k3', kind: 'tool', x: 390, y: 380, label: 'Returns policy', icon: 'doc', step: 1 },
    { id: 'if', kind: 'if', x: 510, y: 200, label: 'Solved?', icon: 'split', step: 2 },
    { id: 'close', kind: 'action', x: 680, y: 100, label: 'Close + rate', meta: 'CSAT survey', icon: 'star', step: 3, layer: 'grow' },
    { id: 'hum', kind: 'action', x: 680, y: 300, label: 'Hand to a person', meta: 'full transcript', icon: 'user', step: 3, layer: 'run' },
    { id: 'rep', kind: 'report', x: 880, y: 200, label: 'Weekly insights', meta: 'top issues', icon: 'chart', step: 4, layer: 'run' },
  ],
  edges: [
    { from: 't', to: 'ag' },
    { from: 'ag', to: 'k1' },
    { from: 'ag', to: 'k2' },
    { from: 'ag', to: 'k3' },
    { from: 'ag', to: 'if' },
    { from: 'if', to: 'close', label: 'yes' },
    { from: 'if', to: 'hum', label: 'no' },
    { from: 'close', to: 'rep' },
    { from: 'hum', to: 'rep' },
  ],
};

export const showcase: Workflow[] = [leadFlow, restaurantFlow, complianceFlow, supportFlow];

/** Captions for the scroll-driven hero, keyed to orderToCash steps. */
export const heroCaptions = [
  { step: 0, k: 'Trigger', t: 'An order comes in.', d: 'From your store or any marketplace. That single event starts the run.' },
  { step: 1, k: 'Action', t: 'Stock updates everywhere.', d: 'The same count on every channel, so you never sell what you do not have.' },
  { step: 2, k: 'AI agent', t: 'An agent checks it.', d: 'It reads the order against fraud rules and customer history before money moves.' },
  { step: 3, k: 'Action', t: 'The invoice writes itself.', d: 'GST-ready, numbered and stored, the moment the order is accepted.' },
  { step: 4, k: 'Branch', t: 'Two jobs, at the same time.', d: 'A courier is booked while the customer gets a WhatsApp update.' },
  { step: 5, k: 'Report', t: 'And it all adds up.', d: 'Books and dashboards update. Nobody touched a spreadsheet.' },
];
