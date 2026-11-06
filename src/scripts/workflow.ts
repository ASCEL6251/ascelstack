// Workflow canvas: renders a Workflow spec as SVG and builds GSAP timelines
// that assemble it node by node, with packets travelling along the connectors.
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ICONS, type Workflow, type WNode } from '../data/workflows';

gsap.registerPlugin(MotionPathPlugin);

const NS = 'http://www.w3.org/2000/svg';
export const VIEW = { w: 1000, h: 520 };

const TILE = 72;
const AGENT_W = 196;
const TOOL_R = 27;

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
};

const size = (n: WNode) =>
  n.kind === 'tool' ? { w: TOOL_R * 2, h: TOOL_R * 2 } : n.kind === 'agent' ? { w: AGENT_W, h: TILE } : { w: TILE, h: TILE };

function icon(name: keyof typeof ICONS, x: number, y: number, s: number, parent: Element) {
  const g = el('g', { transform: `translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})`, class: 'wf-icon' }, parent);
  el('path', { d: ICONS[name] }, g);
  return g;
}

/** Trigger tiles get a large left radius, so a run visibly "starts" there. */
function triggerPath(w: number, h: number) {
  const L = h / 2;
  const R = 14;
  const x0 = -w / 2;
  const y0 = -h / 2;
  return `M${x0 + L} ${y0} H${x0 + w - R} Q${x0 + w} ${y0} ${x0 + w} ${y0 + R} V${y0 + h - R} Q${x0 + w} ${y0 + h} ${x0 + w - R} ${y0 + h} H${x0 + L} A${L} ${L} 0 0 1 ${x0 + L} ${y0} Z`;
}

export interface Rendered {
  svg: SVGSVGElement;
  nodes: Map<string, SVGGElement>;
  edges: { from: string; to: string; tool: boolean; path: SVGPathElement; label?: SVGTextElement; packet: SVGCircleElement }[];
  spec: Workflow;
}

export function renderWorkflow(host: HTMLElement, spec: Workflow): Rendered {
  host.innerHTML = '';
  const svg = el('svg', {
    viewBox: `0 0 ${VIEW.w} ${VIEW.h}`,
    class: 'wf-svg',
    role: 'img',
    'aria-label': `Workflow: ${spec.nodes.filter((n) => n.kind !== 'tool').map((n) => n.label).join(', then ')}`,
  }) as SVGSVGElement;
  host.appendChild(svg);

  const defs = el('defs', {}, svg);
  const glow = el('filter', { id: `glow-${spec.id}`, x: '-200%', y: '-200%', width: '500%', height: '500%' }, defs);
  el('feGaussianBlur', { stdDeviation: 4, result: 'b' }, glow);
  const merge = el('feMerge', {}, glow);
  el('feMergeNode', { in: 'b' }, merge);
  el('feMergeNode', { in: 'SourceGraphic' }, merge);

  const gEdges = el('g', { class: 'wf-edges' }, svg);
  const gPackets = el('g', { class: 'wf-packets' }, svg);
  const gNodes = el('g', { class: 'wf-nodes' }, svg);

  const byId = new Map(spec.nodes.map((n) => [n.id, n]));
  const nodes = new Map<string, SVGGElement>();

  // ---- Edges
  const edges: Rendered['edges'] = spec.edges.map((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    const tool = b.kind === 'tool';
    let d: string;
    if (tool) {
      const sa = size(a);
      const sx = Math.min(Math.max(b.x, a.x - sa.w / 2 + 22), a.x + sa.w / 2 - 22);
      const sy = a.y + sa.h / 2;
      const ty = b.y - TOOL_R;
      const dy = (ty - sy) / 2;
      d = `M${sx} ${sy} C${sx} ${sy + dy} ${b.x} ${ty - dy} ${b.x} ${ty}`;
    } else {
      const sx = a.x + size(a).w / 2;
      const ex = b.x - size(b).w / 2;
      const dx = Math.max(36, (ex - sx) / 2);
      d = `M${sx} ${a.y} C${sx + dx} ${a.y} ${ex - dx} ${b.y} ${ex} ${b.y}`;
    }
    const path = el('path', { d, class: tool ? 'wf-edge wf-edge--tool' : 'wf-edge', pathLength: 1 }, gEdges) as SVGPathElement;
    let label: SVGTextElement | undefined;
    if (e.label) {
      const p = path.getPointAtLength(path.getTotalLength() * 0.55);
      label = el('text', { x: p.x, y: p.y - 8, class: 'wf-edge-label', 'text-anchor': 'middle' }, gEdges) as SVGTextElement;
      label.textContent = e.label;
    }
    const packet = el('circle', { r: tool ? 3.5 : 5, class: 'wf-packet', filter: `url(#glow-${spec.id})`, cx: 0, cy: 0 }, gPackets) as SVGCircleElement;
    return { from: e.from, to: e.to, tool, path, label, packet };
  });

  // ---- Nodes
  for (const n of spec.nodes) {
    const g = el('g', { class: `wf-node wf-node--${n.kind}`, transform: `translate(${n.x} ${n.y})` }, gNodes) as SVGGElement;
    const inner = el('g', { class: 'wf-node-inner' }, g);
    const { w, h } = size(n);

    if (n.kind === 'tool') {
      el('circle', { r: TOOL_R, class: 'wf-tile' }, inner);
      icon(n.icon, 0, 0, 20, inner);
      const t = el('text', { y: TOOL_R + 19, class: 'wf-label wf-label--tool', 'text-anchor': 'middle' }, inner);
      t.textContent = n.label;
    } else {
      el('rect', { x: -w / 2 - 6, y: -h / 2 - 6, width: w + 12, height: h + 12, rx: 21, class: 'wf-ring' }, inner);
      if (n.kind === 'trigger') el('path', { d: triggerPath(w, h), class: 'wf-tile' }, inner);
      else el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 15, class: 'wf-tile' }, inner);

      if (n.kind === 'agent') {
        icon(n.icon, -w / 2 + 34, 0, 26, inner);
        const k = el('text', { x: -w / 2 + 60, y: -7, class: 'wf-kicker' }, inner);
        k.textContent = (n.meta ?? 'AI agent').toUpperCase();
        const t = el('text', { x: -w / 2 + 60, y: 15, class: 'wf-agent-label' }, inner);
        t.textContent = n.label;
        // Port hints for the tool connectors
        el('text', { x: 0, y: h / 2 + 14, class: 'wf-port', 'text-anchor': 'middle' }, inner).textContent = 'tools';
      } else {
        icon(n.icon, n.kind === 'trigger' ? 4 : 0, -2, 27, inner);
        const t = el('text', { y: h / 2 + 22, class: 'wf-label', 'text-anchor': 'middle' }, inner);
        t.textContent = n.label;
        if (n.meta) {
          const m = el('text', { y: h / 2 + 39, class: 'wf-meta', 'text-anchor': 'middle' }, inner);
          m.textContent = n.meta;
        }
      }

      // Strata marker: three bars, the node's layer filled (logo motif).
      if (n.layer) {
        const sx = w / 2 - 12;
        const sy = h / 2 - 15;
        const idx = { build: 0, grow: 1, run: 2 }[n.layer];
        [4, 7, 10].forEach((bw, i) =>
          el('rect', { x: sx - bw / 2, y: sy + i * 4, width: bw, height: 2, rx: 1, class: i === idx ? `wf-strata on ${n.layer}` : 'wf-strata' }, inner),
        );
      }

      // Done badge
      const badge = el('g', { class: 'wf-done', transform: `translate(${w / 2 - 2} ${-h / 2 + 2})` }, g);
      el('circle', { r: 9 }, badge);
      el('path', { d: 'M-4 0l2.6 2.6L4-3' }, badge);
    }
    nodes.set(n.id, g);
  }

  return { svg, nodes, edges, spec };
}

/* -------------------------------------------------------------------------- */

export interface BuildOptions {
  /** Fires as each non-tool node completes (forward play only). */
  onNodeDone?: (n: WNode) => void;
  /** Horizontal scroller to keep the newest node in view on small screens. */
  follow?: HTMLElement | null;
}

/** Assembles the workflow from nothing: nodes pop in, connectors draw, packets travel. */
export function buildTimeline(r: Rendered, opts: BuildOptions = {}) {
  const { spec, nodes, edges } = r;
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  const byId = new Map(spec.nodes.map((n) => [n.id, n]));

  // Initial state
  nodes.forEach((g) => {
    gsap.set(g.querySelector('.wf-node-inner'), { autoAlpha: 0, scale: 0.7, transformOrigin: '50% 50%' });
    const done = g.querySelector('.wf-done');
    if (done) gsap.set(done, { scale: 0, transformOrigin: '50% 50%' });
  });
  edges.forEach((e) => {
    gsap.set(e.path, { strokeDashoffset: 1, strokeDasharray: e.tool ? '0.02 0.02' : '1 1', autoAlpha: e.tool ? 0 : 1 });
    if (e.label) gsap.set(e.label, { autoAlpha: 0 });
    gsap.set(e.packet, { autoAlpha: 0 });
  });

  const focus = { x: 0 };
  const follow = opts.follow;
  if (follow) {
    tl.eventCallback('onUpdate', () => {
      const scale = follow.scrollWidth / VIEW.w;
      follow.scrollLeft = focus.x * scale - follow.clientWidth * 0.6;
    });
  }

  const steps = [...new Set(spec.nodes.map((n) => n.step))].sort((a, b) => a - b);
  let t = 0;

  for (const s of steps) {
    const stepNodes = spec.nodes.filter((n) => n.step === s && n.kind !== 'tool');
    let stepEnd = t;

    stepNodes.forEach((n, k) => {
      const at = t + k * 0.12;
      const incoming = edges.filter((e) => e.to === n.id && !e.tool);
      const arrive = incoming.length ? at + 0.55 : at;

      // Draw connectors in, then a packet travels each one.
      incoming.forEach((e) => {
        tl.to(e.path, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.inOut' }, at);
        if (e.label) tl.to(e.label, { autoAlpha: 1, duration: 0.2 }, at + 0.3);
        tl.set(e.packet, { autoAlpha: 1 }, at + 0.1);
        tl.to(e.packet, { motionPath: { path: e.path, align: e.path, alignOrigin: [0.5, 0.5] }, duration: 0.5, ease: 'power1.inOut' }, at + 0.1);
        tl.set(e.packet, { autoAlpha: 0 }, at + 0.6);
      });

      const g = nodes.get(n.id)!;
      const inner = g.querySelector('.wf-node-inner');
      tl.to(inner, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(1.6)' }, arrive);
      tl.to(focus, { x: n.x, duration: 0.4 }, arrive);
      tl.add(() => g.classList.add('is-active'), arrive);

      // Agent: reach out to tools and back.
      let end = arrive + 0.5;
      if (n.kind === 'agent') {
        const toolEdges = edges.filter((e) => e.from === n.id && e.tool);
        toolEdges.forEach((e, i) => {
          const ta = arrive + 0.3 + i * 0.12;
          tl.to(e.path, { autoAlpha: 1, strokeDashoffset: 0, duration: 0.3 }, ta);
          tl.to(nodes.get(e.to)!.querySelector('.wf-node-inner'), { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(1.6)' }, ta + 0.15);
          tl.set(e.packet, { autoAlpha: 1 }, ta + 0.4);
          tl.to(e.packet, { motionPath: { path: e.path, align: e.path, alignOrigin: [0.5, 0.5] }, duration: 0.35, ease: 'power1.inOut', yoyo: true, repeat: 1 }, ta + 0.4);
          tl.set(e.packet, { autoAlpha: 0 }, ta + 1.1);
          end = Math.max(end, ta + 1.15);
        });
      }

      const done = g.querySelector('.wf-done');
      if (done) tl.to(done, { scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, end);
      tl.add(() => {
        g.classList.remove('is-active');
        opts.onNodeDone?.(byId.get(n.id)!);
      }, end);
      stepEnd = Math.max(stepEnd, end);
    });

    t = stepEnd + 0.1;
  }
  return tl;
}

/** A repeatable "run": packets travel the finished graph in step order. */
export function runTimeline(r: Rendered) {
  const { spec, edges, nodes } = r;
  const byId = new Map(spec.nodes.map((n) => [n.id, n]));
  const tl = gsap.timeline({ paused: true });
  edges
    .filter((e) => !e.tool)
    .sort((a, b) => byId.get(a.from)!.step - byId.get(b.from)!.step)
    .forEach((e) => {
      const at = byId.get(e.from)!.step * 0.55;
      tl.set(e.packet, { autoAlpha: 1 }, at);
      tl.fromTo(
        e.packet,
        { motionPath: { path: e.path, align: e.path, alignOrigin: [0.5, 0.5], start: 0, end: 0 } },
        { motionPath: { path: e.path, align: e.path, alignOrigin: [0.5, 0.5], start: 0, end: 1 }, duration: 0.55, ease: 'power1.inOut' },
        at,
      );
      tl.set(e.packet, { autoAlpha: 0 }, at + 0.55);
      const target = nodes.get(e.to)!;
      tl.add(() => target.classList.add('is-active'), at + 0.45);
      tl.add(() => target.classList.remove('is-active'), at + 0.9);
    });
  return tl;
}
