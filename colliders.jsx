// v3 — U labels above nodes
import { useState, useMemo, useEffect } from "react";

// ─── Responsive hook ────────────────────────────────────────────────────────

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handle = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  return size;
}

// ─── Seeded RNG ─────────────────────────────────────────────────────────────

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededNormal(rng) {
  let u1 = Math.min(0.9999, Math.max(0.0001, rng()));
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─── Examples ───────────────────────────────────────────────────────────────
// paths for collider: { xc, yc } = X→C, Y→C
// paths for mbias:    { u1x, u1m, u2y, u2m } = U1→X, U1→M, U2→Y, U2→M

const COLLIDERS = [
  { id:"c1", type:"collider",
    title:"Height → Skill in NBA", sub:"Conditioning on NBA selection",
    x:"Height", y:"Basketball Skill", m:"In the NBA",
    paths: { xc: 0.70, yc: 0.65 },
    pathsCite:"Height→NBA from selection rates (17% of 7-footers; Sports Illustrated / Stephens-Davidowitz). Skill→NBA slightly lower—height alone opens doors.",
    realisticBeta: 0.10,
    realisticCite:"Taller youth steered toward basketball → weak positive (Stephens-Davidowitz 2024)",
    story:"Height and skill may be weakly positively correlated (taller kids get steered toward basketball and receive more coaching). Both independently and strongly cause NBA selection—17% of American 7-footers make the league. Conditioning on selection creates a strong negative correlation.",
  },
  { id:"c2", type:"collider",
    title:"Tech Quality → Marketing", sub:"Conditioning on VC funding",
    x:"Technical Quality", y:"Marketing Quality", m:"VC Funded",
    paths: { xc: 0.50, yc: 0.45 },
    pathsCite:"Product rated important by 74% of VCs, traction/market validation close behind (Gompers et al. 2020, Kaplan & Strömberg 2004).",
    realisticBeta: 0.05,
    realisticCite:"Weak positive—strong founding teams do both (Ewens et al. 2018, Gompers et al. 2020)",
    story:"A startup's technical and marketing quality may be weakly correlated (strong founding teams tend to be good at both). VCs weight product quality (74%) and market traction heavily. Conditioning on funding creates a negative correlation among funded startups.",
  },
  { id:"c3", type:"collider",
    title:"Looks → Talent in Hollywood", sub:"Conditioning on stardom",
    x:"Attractiveness", y:"Acting Talent", m:"Movie Star",
    paths: { xc: 0.40, yc: 0.55 },
    pathsCite:"Beauty premium from Hamermesh & Biddle 1994; talent as primary career driver from Elberse 2007 (star power & box office).",
    realisticBeta: 0.03,
    realisticCite:"Near-zero in population; maybe tiny confidence/self-selection effect",
    story:"Attractiveness and acting talent are nearly uncorrelated in the population. Both independently help become a star—talent more so (awards, craft) but looks carry a real premium (Hamermesh & Biddle 1994). Conditioning on stardom creates a negative correlation among stars.",
  },
];

const MBIAS = [
  { id:"m1", type:"mbias",
    title:"Education → Health", sub:"Controlling for parental income",
    x:"Years of Schooling", y:"Health Outcomes", m:"Parental Income",
    u1s:["Family academic culture","Neighborhood quality","Parental education"],
    u2s:["Family health genetics","Childhood nutrition","Access to healthcare"],
    paths: { u1x: 0.80, u1m: 0.75, u2y: 0.80, u2m: 0.75 },
    pathsCite:"In reality, many different U1s and U2s exist. The DAG shows one pair; the simulation assumes their combined effects are large.",
    realisticBeta: 0.25,
    realisticCite:"~0.15–0.3 SD from compulsory schooling studies (Lleras-Muney 2005, Clark & Royer 2013)",
    story:"Family academic culture drives both schooling and parental income. Family health genetics drive both health outcomes and parental income. Parental income is a collider—conditioning on it opens a backdoor path.",
  },
  { id:"m2", type:"mbias",
    title:"Min. Wage → Employment", sub:"Controlling for county median income",
    x:"Minimum Wage", y:"Employment Rate", m:"County Median Income",
    u1s:["Political liberalism","Urban density","Union strength"],
    u2s:["Industry composition","Local business climate","Workforce skill level"],
    paths: { u1x: 0.80, u1m: 0.75, u2y: 0.80, u2m: 0.75 },
    pathsCite:"In reality, many different U1s and U2s exist. The DAG shows one pair; the simulation assumes their combined effects are large.",
    realisticBeta: -0.04,
    realisticCite:"Near-zero to small negative (Cengiz et al. 2019, Dube 2019)",
    story:"Liberal areas raise minimum wages and have higher median incomes. Industry mix independently affects employment and incomes. County median income is a collider.",
  },
  { id:"m3", type:"mbias",
    title:"Foreign Aid → Growth", sub:"Controlling for governance quality",
    x:"Foreign Aid", y:"Economic Growth", m:"Governance Quality",
    u1s:["Geopolitical importance","Donor colonial ties","Strategic location"],
    u2s:["Colonial institutions","Natural geography","Pre-colonial state capacity"],
    paths: { u1x: 0.80, u1m: 0.75, u2y: 0.80, u2m: 0.75 },
    pathsCite:"In reality, many different U1s and U2s exist. The DAG shows one pair; the simulation assumes their combined effects are large.",
    realisticBeta: 0.06,
    realisticCite:"Modest positive for short-impact aid (Clemens et al. 2012, Galiani et al. 2017)",
    story:"Geopolitically important countries get more aid and face governance pressure. Colonial legacies drive growth and governance. Governance quality is a collider.",
  },
  { id:"m4", type:"mbias",
    title:"Class Size → Test Scores", sub:"Controlling for school spending",
    x:"Class Size", y:"Test Scores", m:"School Spending / Pupil",
    u1s:["District pop. density","Urbanization level","School district size"],
    u2s:["Parental involvement","Community wealth","Local education culture"],
    paths: { u1x: 0.80, u1m: 0.75, u2y: 0.80, u2m: 0.75 },
    pathsCite:"In reality, many different U1s and U2s exist. The DAG shows one pair; the simulation assumes their combined effects are large.",
    realisticBeta: -0.15,
    realisticCite:"STAR experiment: ~0.15–0.2 SD (Krueger 1999, Chetty et al. 2011)",
    story:"Dense districts have larger classes and bigger tax bases. Involved parents boost scores and vote for levies. Spending per pupil is a collider.",
  },
  { id:"m5", type:"mbias",
    title:"Immigration → Native Wages", sub:"Controlling for housing prices",
    x:"Immigration Rate", y:"Native Wages", m:"Local Housing Prices",
    u1s:["Labor demand shocks","Economic booms","Industry expansion"],
    u2s:["Local amenity value","Climate & geography","Cultural institutions"],
    paths: { u1x: 0.80, u1m: 0.75, u2y: 0.80, u2m: 0.75 },
    pathsCite:"In reality, many different U1s and U2s exist. The DAG shows one pair; the simulation assumes their combined effects are large.",
    realisticBeta: -0.03,
    realisticCite:"Small effects (Card 2009, Peri & Sparber 2009, Dustmann et al. 2016)",
    story:"Labor demand pulls immigrants and raises housing prices. Amenities boost wages and prices. Conditioning on housing prices opens a backdoor path.",
  },
  { id:"m6", type:"mbias",
    title:"R&D → Firm Profits", sub:"Controlling for credit rating",
    x:"R&D Spending", y:"Firm Profits", m:"Credit Rating",
    u1s:["CEO risk tolerance","Firm maturity","Access to capital"],
    u2s:["Market position / moat","Brand strength","Regulatory barriers"],
    paths: { u1x: 0.80, u1m: 0.75, u2y: 0.80, u2m: 0.75 },
    pathsCite:"In reality, many different U1s and U2s exist. The DAG shows one pair; the simulation assumes their combined effects are large.",
    realisticBeta: 0.15,
    realisticCite:"Positive with lags (Hall, Mairesse & Mohnen 2010, Bloom et al. 2013)",
    story:"Risk-tolerant CEOs spend on R&D and take leverage. Strong market position drives profits and creditworthiness. Credit rating is a collider.",
  },
  { id:"m7", type:"mbias",
    title:"Trade Openness → Inequality", sub:"Controlling for FDI inflows",
    x:"Trade Openness", y:"Income Inequality", m:"FDI Inflows",
    u1s:["Institutional liberalization","WTO membership","Policy reform"],
    u2s:["Resource endowment","Colonial extraction legacy","Land concentration"],
    paths: { u1x: 0.80, u1m: 0.75, u2y: 0.80, u2m: 0.75 },
    pathsCite:"In reality, many different U1s and U2s exist. The DAG shows one pair; the simulation assumes their combined effects are large.",
    realisticBeta: 0.10,
    realisticCite:"Modest positive in developing countries (Goldberg & Pavcnik 2007)",
    story:"Liberalizing institutions open trade and attract FDI. Natural resources drive inequality and attract FDI. FDI inflows are a collider.",
  },
  { id:"m8", type:"mbias",
    title:"Health Insurance → Health", sub:"Controlling for employment status",
    x:"Health Insurance", y:"Health Outcomes", m:"Employment Status",
    u1s:["Risk aversion","Education level","Financial literacy"],
    u2s:["Baseline health","Childhood conditions","Genetic endowment"],
    paths: { u1x: 0.80, u1m: 0.75, u2y: 0.80, u2m: 0.75 },
    pathsCite:"In reality, many different U1s and U2s exist. The DAG shows one pair; the simulation assumes their combined effects are large.",
    realisticBeta: 0.10,
    realisticCite:"Modest improvements, esp. mental health (Oregon HIE: Finkelstein et al. 2012)",
    story:"Risk-averse people buy insurance and hold stable jobs. Healthy people have better outcomes and are more employable. Employment is a collider.",
  },
  { id:"m9", type:"mbias",
    title:"Interest Rates → Inflation", sub:"Controlling for exchange rate",
    x:"Interest Rate Changes", y:"Inflation Rate", m:"Exchange Rate",
    u1s:["CB credibility","Institutional independence","Policy regime"],
    u2s:["Commodity prices","Oil supply shocks","Terms of trade"],
    paths: { u1x: 0.80, u1m: 0.75, u2y: 0.80, u2m: 0.75 },
    pathsCite:"In reality, many different U1s and U2s exist. The DAG shows one pair; the simulation assumes their combined effects are large.",
    realisticBeta: -0.20,
    realisticCite:"Standard monetary transmission ~0.2 SD (Romer & Romer 2004, Ramey 2016)",
    story:"Central bank credibility shapes rates and exchange rates. Global commodity prices drive inflation and exchange rates. Exchange rate is a collider.",
  },
  { id:"m10", type:"mbias",
    title:"Sentence Length → Recidivism", sub:"Controlling for pre-trial detention",
    x:"Sentence Length", y:"Recidivism", m:"Pre-trial Detention",
    u1s:["Prosecutorial severity","Judicial ideology","Crime severity"],
    u2s:["Social instability","Poverty & unemployment","Substance abuse"],
    paths: { u1x: 0.80, u1m: 0.75, u2y: 0.80, u2m: 0.75 },
    pathsCite:"In reality, many different U1s and U2s exist. The DAG shows one pair; the simulation assumes their combined effects are large.",
    realisticBeta: 0.05,
    realisticCite:"Slight criminogenic effect (Mueller-Smith 2015, Green & Winik 2010)",
    story:"Tough prosecutors push longer sentences and oppose bail. Social instability drives recidivism and detention. Pre-trial detention is a collider.",
  },
];

const ALL = [...COLLIDERS, ...MBIAS];

// ─── Stats ──────────────────────────────────────────────────────────────────

function mean(arr) { return arr.reduce((s,v) => s+v, 0) / arr.length; }

function simpleReg(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let num=0, den=0;
  for (let i=0; i<xs.length; i++) { num += (xs[i]-mx)*(ys[i]-my); den += (xs[i]-mx)*(xs[i]-mx); }
  const slope = den === 0 ? 0 : num/den;
  const n = xs.length;
  const sse = ys.reduce((s,y,i) => s + (y - (my + slope*(xs[i]-mx)))**2, 0);
  const se = Math.sqrt(sse / (n-2) / den);
  return { slope, se, intercept: my - slope*mx };
}

function multiReg(xs, ms, ys) {
  const n = xs.length;
  const mx=mean(xs), mm=mean(ms), my=mean(ys);
  let sxx=0, smm=0, sxm=0, sxy=0, smy=0;
  for (let i=0; i<n; i++) {
    const dx=xs[i]-mx, dm=ms[i]-mm, dy=ys[i]-my;
    sxx+=dx*dx; smm+=dm*dm; sxm+=dx*dm; sxy+=dx*dy; smy+=dm*dy;
  }
  const det = sxx*smm - sxm*sxm;
  if (Math.abs(det)<1e-10) return { slopeX:0, slopeM:0, seX:0 };
  const b1 = (smm*sxy - sxm*smy)/det;
  const b2 = (sxx*smy - sxm*sxy)/det;
  const intercept = my - b1*mx - b2*mm;
  const sse = ys.reduce((s,y,i) => s + (y - (intercept + b1*xs[i] + b2*ms[i]))**2, 0);
  const mse = sse / (n-3);
  const seX = Math.sqrt(mse * smm / det);
  return { slopeX:b1, slopeM:b2, seX, intercept };
}

// ─── Data Generation (uses per-example path coefficients) ───────────────────

function generateData(ex, n, seed, trueBeta) {
  const rng = mulberry32(seed);
  const p = ex.paths;
  const data = [];
  if (ex.type === "mbias") {
    // M-bias: U1→X, U1→M, U2→Y, U2→M, optionally X→Y
    const nxSD = Math.sqrt(Math.max(0.05, 1 - p.u1x * p.u1x));
    const nySD = Math.sqrt(Math.max(0.05, 1 - p.u2y * p.u2y));
    const nmSD = Math.sqrt(Math.max(0.05, 1 - p.u1m * p.u1m - p.u2m * p.u2m));
    for (let i = 0; i < n; i++) {
      const u1 = seededNormal(rng), u2 = seededNormal(rng);
      const x = p.u1x * u1 + nxSD * seededNormal(rng);
      const y = trueBeta * x + p.u2y * u2 + nySD * seededNormal(rng);
      const m = p.u1m * u1 + p.u2m * u2 + nmSD * seededNormal(rng);
      data.push({ x, y, m });
    }
  } else {
    // Simple collider: X→C, Y→C, optionally X→Y
    const ncSD = Math.sqrt(Math.max(0.05, 1 - p.xc * p.xc - p.yc * p.yc));
    for (let i = 0; i < n; i++) {
      const x = seededNormal(rng);
      const y = trueBeta * x + seededNormal(rng);
      const m = p.xc * x + p.yc * y + ncSD * seededNormal(rng);
      data.push({ x, y, m });
    }
  }
  return data;
}

function computeAdjusted(data) {
  const xs = data.map(d=>d.x), ys = data.map(d=>d.y), ms = data.map(d=>d.m);
  const reg = multiReg(xs, ms, ys);
  const mm = mean(ms);
  return data.map((d) => ({ ...d, adjY: d.y - reg.slopeM * (d.m - mm) }));
}

// ─── Toggle Switch ──────────────────────────────────────────────────────────

function Toggle({ on, onToggle, leftLabel, rightLabel, compact }) {
  return (
    <div style={{
      display:"inline-flex", alignItems:"center", gap: compact ? 4 : 6,
      fontSize: compact ? 10 : 11, fontWeight:600,
      fontFamily:"'Source Serif 4',Georgia,serif",
      userSelect:"none",
    }}>
      <span style={{ color: on ? "#94a3b8" : "#0f172a", cursor:"pointer" }} onClick={() => on && onToggle()}>
        {leftLabel}
      </span>
      <div onClick={onToggle} style={{
        width:36, height:20, borderRadius:10, cursor:"pointer",
        background: on ? "#16a34a" : "#cbd5e1",
        position:"relative", transition:"background 0.2s", flexShrink:0,
      }}>
        <div style={{
          width:16, height:16, borderRadius:8,
          background:"#fff", boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
          position:"absolute", top:2, left: on ? 18 : 2, transition:"left 0.2s",
        }}/>
      </div>
      <span style={{ color: on ? "#16a34a" : "#94a3b8", cursor:"pointer" }} onClick={() => !on && onToggle()}>
        {rightLabel}
      </span>
    </div>
  );
}

// ─── DAG with coefficients on arrows ────────────────────────────────────────

function DAG({ example, conditioned, compact, hasDirectEffect }) {
  const isM = example.type === "mbias";
  const p = example.paths;
  const w = 460, h = isM ? (compact ? 270 : 290) : (compact ? 220 : 240);
  const vbY = 0;
  const vbH = h;
  const by = isM ? (compact ? 210 : 230) : (compact ? 165 : 185);
  const my = isM ? (compact ? 150 : 160) : (compact ? 165 : 180);

  const nodes = isM ? [
    { id:"u1", label:example.u1s?.[0] || "U1", x:100, y:75, dashed:true },
    { id:"u2", label:example.u2s?.[0] || "U2", x:360, y:75, dashed:true },
    { id:"x", label:example.x, x:60, y:by },
    { id:"y", label:example.y, x:400, y:by },
    { id:"m", label:example.m, x:230, y:my, isC:true },
  ] : [
    { id:"x", label:example.x, x:80, y:60 },
    { id:"y", label:example.y, x:380, y:60 },
    { id:"m", label:example.m, x:230, y:compact ? 165 : 180, isC:true },
  ];

  // edges: [from, to, coefficient]
  const edges = isM
    ? [["u1","x",p.u1x],["u1","m",p.u1m],["u2","y",p.u2y],["u2","m",p.u2m]]
    : [["x","m",p.xc],["y","m",p.yc]];

  const nMap = {}; nodes.forEach(n => nMap[n.id]=n);

  // Place label at t along edge (0=source, 1=target), offset perpendicular
  const edgeLabel = (f, t, coef, tPos, side) => {
    const a = nMap[f], b = nMap[t];
    const px = a.x + (b.x - a.x) * tPos;
    const py = a.y + (b.y - a.y) * tPos;
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.sqrt(dx*dx + dy*dy);
    const off = side === "left" ? -11 : 11;
    const nx = -dy/l * off, ny = dx/l * off;
    return (
      <text key={`lbl-${f}-${t}`}
        x={px + nx} y={py + ny + 3}
        textAnchor="middle" fontSize={10} fontWeight={700}
        fontFamily="'JetBrains Mono',monospace"
        fill="#475569" opacity={0.75}>
        {coef.toFixed(2)}
      </text>
    );
  };


  return (
    <svg viewBox={`0 ${vbY} ${w} ${vbH}`} style={{ width:"100%", height:"auto" }}>
      <defs>
        <marker id="ah" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#64748b"/></marker>
        <marker id="ahr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#dc2626"/></marker>
        <marker id="ahg" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#16a34a"/></marker>
      </defs>

      {/* Structural edges */}
      {edges.map(([f,t,coef],i) => {
        const a=nMap[f], b=nMap[t], dx=b.x-a.x, dy=b.y-a.y, l=Math.sqrt(dx*dx+dy*dy), r=22;
        return <line key={i} x1={a.x+dx/l*r} y1={a.y+dy/l*r} x2={b.x-dx/l*(r+7)} y2={b.y-dy/l*(r+7)} stroke="#64748b" strokeWidth={1.8} markerEnd="url(#ah)" opacity={0.65}/>;
      })}

      {/* Coefficient labels — near X/Y (above), near M (below) */}
      {isM ? <>
        {edgeLabel("u1","x", p.u1x, 0.75, "left")}
        {edgeLabel("u1","m", p.u1m, 0.65, "right")}
        {edgeLabel("u2","y", p.u2y, 0.75, "right")}
        {edgeLabel("u2","m", p.u2m, 0.65, "left")}
      </> : <>
        {edgeLabel("x","m", p.xc, 0.25, "left")}
        {edgeLabel("y","m", p.yc, 0.25, "right")}
      </>}

      {/* Direct X→Y (realistic effect) */}
      {hasDirectEffect && (() => {
        const a=nMap.x, b=nMap.y, dx=b.x-a.x, dy=b.y-a.y, l=Math.sqrt(dx*dx+dy*dy), r=22;
        const mx = (a.x+b.x)/2, my2 = (a.y+b.y)/2;
        const beta = example.realisticBeta;
        return <g>
          <line x1={a.x+dx/l*r} y1={a.y+dy/l*r} x2={b.x-dx/l*(r+7)} y2={b.y-dy/l*(r+7)}
            stroke="#16a34a" strokeWidth={2.5} markerEnd="url(#ahg)" opacity={0.8}/>
          <text x={mx} y={my2 + (isM ? 14 : -8)} textAnchor="middle" fontSize={10} fontWeight={700}
            fontFamily="'JetBrains Mono',monospace" fill="#16a34a" opacity={0.85}>
            {beta >= 0 ? "+" : ""}{beta.toFixed(2)}
          </text>
        </g>;
      })()}

      {/* Spurious path */}
      {conditioned && (() => {
        const a=nMap.x, b=nMap.y, dx=b.x-a.x, dy=b.y-a.y, l=Math.sqrt(dx*dx+dy*dy);
        const off = hasDirectEffect ? 8 : 0;
        return <line x1={a.x-dy/l*off} y1={a.y+dx/l*off} x2={b.x-dy/l*off} y2={b.y+dx/l*off}
          stroke="#dc2626" strokeWidth={2.5} strokeDasharray="7,4" opacity={0.8} markerEnd="url(#ahr)"/>;
      })()}

      {/* Nodes */}
      {nodes.map(n => {
        const isCond = conditioned && n.isC;
        const isU = isM && n.dashed;
        return (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={20}
              fill={isCond ? "#fef2f2" : n.dashed ? "#f8fafc" : "#fff"}
              stroke={isCond ? "#dc2626" : n.dashed ? "#94a3b8" : "#475569"}
              strokeWidth={isCond ? 2.5 : 1.5} strokeDasharray={n.dashed ? "3,2" : "none"}/>
            {isCond && <rect x={n.x-24} y={n.y-24} width={48} height={48} fill="none" stroke="#dc2626" strokeWidth={2} rx={4}/>}
            <text x={n.x} y={n.y+4} textAnchor="middle" fontSize={12} fontWeight={700}
              fontFamily="'JetBrains Mono',monospace"
              fill={isCond ? "#dc2626" : n.dashed ? "#64748b" : "#0f172a"}>
              {n.id==="m" ? (isM?"M":"C") : n.id.toUpperCase()}
            </text>
            {n.label && !isU && (
              <text x={n.x} y={n.y + ((!isM && !n.isC) ? -30 : 36)} textAnchor="middle" fontSize={9}
                fontFamily="'Source Serif 4',Georgia,serif"
                fill={isCond ? "#dc2626" : "#475569"}>
                {n.label}
              </text>
            )}
            {isU && (n.id === "u1" ? example.u1s : example.u2s)?.map((txt, i, arr) => (
              <text key={i} x={n.x} y={n.y - 28 - (arr.length - 1 - i) * 11}
                textAnchor="middle" fontSize={8}
                fontFamily="'Source Serif 4',Georgia,serif"
                fontStyle="italic" fill="#64748b">
                {txt}
              </text>
            ))}
          </g>
        );
      })}


      {/* Legend */}
      <g>
        {isM && <><line x1={12} y1={h-10} x2={28} y2={h-10} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3,2"/>
          <text x={32} y={h-6} fontSize={8} fill="#94a3b8" fontFamily="'Source Serif 4',Georgia,serif">Unobserved</text></>}
        {hasDirectEffect && <><line x1={isM?105:12} y1={h-10} x2={isM?121:28} y2={h-10} stroke="#16a34a" strokeWidth={2}/>
          <text x={isM?125:32} y={h-6} fontSize={8} fill="#16a34a" fontFamily="'Source Serif 4',Georgia,serif">True effect</text></>}
        {conditioned && <><line x1={hasDirectEffect?(isM?205:120):(isM?105:12)} y1={h-10} x2={hasDirectEffect?(isM?221:136):(isM?121:28)} y2={h-10} stroke="#dc2626" strokeWidth={2} strokeDasharray="7,4"/>
          <text x={hasDirectEffect?(isM?225:140):(isM?125:32)} y={h-6} fontSize={8} fill="#dc2626" fontFamily="'Source Serif 4',Georgia,serif">Spurious</text></>}
      </g>

    </svg>
  );
}

// ─── Arrow Scatterplot ──────────────────────────────────────────────────────

function ArrowScatter({ data, adjusted, conditioned, example, showArrows, compact }) {
  const w = compact ? 380 : 460, h = compact ? 280 : 320;
  const pad = { top:20, right:16, bottom:36, left:44 };
  const pw = w-pad.left-pad.right, ph = h-pad.top-pad.bottom;

  const allX = data.map(d=>d.x);
  const allY = [...data.map(d=>d.y), ...adjusted.map(d=>d.adjY)];
  let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
  for(let i=0;i<allX.length;i++){if(allX[i]<xMin)xMin=allX[i];if(allX[i]>xMax)xMax=allX[i];}
  for(let i=0;i<allY.length;i++){if(allY[i]<yMin)yMin=allY[i];if(allY[i]>yMax)yMax=allY[i];}
  xMin-=0.3;xMax+=0.3;yMin-=0.3;yMax+=0.3;
  const sx = v => pad.left+((v-xMin)/(xMax-xMin))*pw;
  const sy = v => pad.top+ph-((v-yMin)/(yMax-yMin))*ph;

  const step = Math.max(1, Math.floor(data.length / (compact ? 50 : 80)));
  const arrowIdx = data.map((_,i) => i).filter(i => i%step===0);
  const maxDots = compact ? 600 : 800;
  const dotStep = Math.max(1, Math.floor(data.length / maxDots));
  const uncondReg = simpleReg(data.map(d=>d.x), data.map(d=>d.y));
  const mMedian = [...data.map(d=>d.m)].sort((a,b)=>a-b)[Math.floor(data.length/2)];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width:"100%", height:"auto" }}>
      <defs>
        <marker id="ab" markerWidth="5" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0,5 2,0 4" fill="#3b82f6" opacity="0.7"/></marker>
        <marker id="aa" markerWidth="5" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0,5 2,0 4" fill="#f59e0b" opacity="0.7"/></marker>
      </defs>
      {[0.25,0.5,0.75].map(f => <g key={f}>
        <line x1={pad.left} y1={pad.top+ph*f} x2={pad.left+pw} y2={pad.top+ph*f} stroke="#f1f5f9" strokeWidth={1}/>
        <line x1={pad.left+pw*f} y1={pad.top} x2={pad.left+pw*f} y2={pad.top+ph} stroke="#f1f5f9" strokeWidth={1}/>
      </g>)}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top+ph} stroke="#e2e8f0" strokeWidth={1}/>
      <line x1={pad.left} y1={pad.top+ph} x2={pad.left+pw} y2={pad.top+ph} stroke="#e2e8f0" strokeWidth={1}/>
      <text x={pad.left+pw/2} y={h-4} textAnchor="middle" fontSize={compact?8:10} fill="#64748b" fontFamily="'Source Serif 4',Georgia,serif">{example.x}</text>
      <text x={10} y={pad.top+ph/2} textAnchor="middle" fontSize={compact?8:10} fill="#64748b" fontFamily="'Source Serif 4',Georgia,serif"
        transform={`rotate(-90,10,${pad.top+ph/2})`}>{conditioned ? `${example.y} (adj)` : example.y}</text>

      {conditioned && showArrows && arrowIdx.map(i => {
        const d=data[i], a=adjusted[i], px=sx(d.x), fromY=sy(d.y), toY=sy(a.adjY);
        if (Math.abs(toY-fromY)<3) return null;
        const isHigh = d.m > mMedian;
        return <line key={`a${i}`} x1={px} y1={fromY} x2={px} y2={toY}
          stroke={isHigh?"#3b82f6":"#f59e0b"} strokeWidth={1.2} opacity={0.4}
          markerEnd={isHigh?"url(#ab)":"url(#aa)"}/>;
      })}
      {data.map((d,i) => i%dotStep===0 && <circle key={`o${i}`} cx={sx(d.x)} cy={sy(d.y)} r={conditioned?1.5:2.2}
        fill={conditioned?"#cbd5e1":"#64748b"} opacity={conditioned?0.18:0.3}/>)}
      {conditioned && adjusted.map((d,i) => i%dotStep===0 && <circle key={`c${i}`} cx={sx(d.x)} cy={sy(d.adjY)} r={2.5}
        fill={d.m>mMedian?"#3b82f6":"#f59e0b"} opacity={0.5}/>)}

      {!conditioned && (() => { const r=uncondReg; return <line x1={sx(xMin+0.3)} y1={sy(r.intercept+r.slope*(xMin+0.3))}
        x2={sx(xMax-0.3)} y2={sy(r.intercept+r.slope*(xMax-0.3))} stroke="#475569" strokeWidth={2} opacity={0.5}/>; })()}
      {conditioned && (() => { const r=simpleReg(data.map(d=>d.x),adjusted.map(d=>d.adjY)); return <line x1={sx(xMin+0.3)} y1={sy(r.intercept+r.slope*(xMin+0.3))}
        x2={sx(xMax-0.3)} y2={sy(r.intercept+r.slope*(xMax-0.3))} stroke="#dc2626" strokeWidth={2.5} opacity={0.85}/>; })()}

      {conditioned && <g>
        <rect x={pad.left+3} y={pad.top+3} width={compact?175:200} height={showArrows?52:38} rx={4} fill="white" fillOpacity={0.9} stroke="#e2e8f0" strokeWidth={1}/>
        <circle cx={pad.left+13} cy={pad.top+15} r={3.5} fill="#3b82f6" opacity={0.7}/>
        <text x={pad.left+20} y={pad.top+18} fontSize={8.5} fill="#3b82f6" fontFamily="'Source Serif 4',Georgia,serif">High {example.m.length>16?"M":example.m} — Y ↓</text>
        <circle cx={pad.left+13} cy={pad.top+29} r={3.5} fill="#f59e0b" opacity={0.7}/>
        <text x={pad.left+20} y={pad.top+32} fontSize={8.5} fill="#f59e0b" fontFamily="'Source Serif 4',Georgia,serif">Low {example.m.length>16?"M":example.m} — Y ↑</text>
        {showArrows && <text x={pad.left+13} y={pad.top+46} fontSize={8} fill="#94a3b8" fontFamily="'Source Serif 4',Georgia,serif">↕ Arrows = Y shift from "controlling"</text>}
      </g>}
    </svg>
  );
}

// ─── Coefficient Display ────────────────────────────────────────────────────

function CoefBar({ data, conditioned, example, compact, trueBeta }) {
  const xs=data.map(d=>d.x), ys=data.map(d=>d.y), ms=data.map(d=>d.m);
  const uncond=simpleReg(xs,ys), cond=multiReg(xs,ms,ys);
  const s0=uncond.slope, se0=uncond.se, s1=cond.slopeX, se1=cond.seX;
  const t0=se0>0?Math.abs(s0/se0):0, t1=se1>0?Math.abs(s1/se1):0;
  const isReal = trueBeta !== 0;

  const Row = ({slope,se,t,label,active,isCond}) => {
    const sig=t>1.96;
    let badge, bCol, bBg;
    if (!sig) { badge="NOT SIG."; bCol="#16a34a"; bBg="#dcfce7"; }
    else if (isCond) { badge=isReal?"SIG. · BIASED":"SIG. · SPURIOUS"; bCol="#dc2626"; bBg="#fee2e2"; }
    else { badge="SIGNIFICANT"; bCol="#b45309"; bBg="#fef3c7"; }
    return (
      <div style={{
        display:"flex", alignItems:"center", gap:8,
        padding: compact ? "5px 8px" : "6px 12px",
        background: active ? (sig&&isCond ? "#fef2f2" : "#f8fafc") : "#f8fafc",
        borderRadius:6, border: active&&sig&&isCond ? "1px solid #fca5a5" : "1px solid #e2e8f0",
        opacity: active ? 1 : 0.5, fontSize: compact ? 11 : 12,
      }}>
        <span style={{ color:"#64748b", minWidth: compact ? 70 : 100, fontFamily:"'Source Serif 4',Georgia,serif", fontSize: compact?10:11 }}>{label}</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700,
          color: active&&sig&&isCond ? "#dc2626" : "#334155", fontSize: compact ? 13 : 14 }}>
          β={slope.toFixed(3)}
        </span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", color:"#94a3b8", fontSize:10 }}>({se.toFixed(3)})</span>
        {active && <span style={{ fontSize:8, fontWeight:700, color:bCol, background:bBg, padding:"1px 5px", borderRadius:6, whiteSpace:"nowrap" }}>{badge}</span>}
      </div>
    );
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <Row slope={s0} se={se0} t={t0} label="No controls" active={!conditioned} isCond={false}/>
      <Row slope={s1} se={se1} t={t1} label={`+ ${example.m.length>18?"M":example.m}`} active={conditioned} isCond={true}/>
      <div style={{ fontSize:10, color:"#94a3b8", textAlign:"center", fontFamily:"'Source Serif 4',Georgia,serif" }}>
        True β = {trueBeta.toFixed(3)}{isReal && <span style={{color:"#16a34a"}}> (literature)</span>}
      </div>
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────

function SidebarContent({ selId, setSelId, onSelect }) {
  return (
    <div style={{ padding:"6px 0" }}>
      <div style={{ padding:"6px 16px", fontSize:9, fontWeight:700, color:"#2563eb", textTransform:"uppercase", letterSpacing:1.5 }}>
        Classic Colliders ({COLLIDERS.length})</div>
      {COLLIDERS.map(ex => (
        <button key={ex.id} onClick={() => { setSelId(ex.id); onSelect && onSelect(); }} style={{
          display:"block", width:"100%", textAlign:"left", border:"none",
          padding:"7px 16px", cursor:"pointer",
          background: selId===ex.id ? "#f1f5f9" : "transparent",
          borderLeft: selId===ex.id ? "3px solid #2563eb" : "3px solid transparent",
          fontFamily:"'Source Serif 4',Georgia,serif",
        }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#0f172a" }}>{ex.title}</div>
          <div style={{ fontSize:10, color:"#64748b" }}>{ex.sub}</div>
        </button>
      ))}
      <div style={{ padding:"6px 16px", marginTop:8, fontSize:9, fontWeight:700, color:"#dc2626", textTransform:"uppercase", letterSpacing:1.5 }}>
        M-Bias ({MBIAS.length})</div>
      {MBIAS.map(ex => (
        <button key={ex.id} onClick={() => { setSelId(ex.id); onSelect && onSelect(); }} style={{
          display:"block", width:"100%", textAlign:"left", border:"none",
          padding:"7px 16px", cursor:"pointer",
          background: selId===ex.id ? "#f1f5f9" : "transparent",
          borderLeft: selId===ex.id ? "3px solid #dc2626" : "3px solid transparent",
          fontFamily:"'Source Serif 4',Georgia,serif",
        }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#0f172a" }}>{ex.title}</div>
          <div style={{ fontSize:10, color:"#64748b" }}>{ex.sub}</div>
        </button>
      ))}
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const { w: winW } = useWindowSize();
  const isNarrow = winW < 1000;
  const isMobile = winW < 600;

  const [selId, setSelId] = useState("c1");
  const [conditioned, setConditioned] = useState(false);
  const [showArrows, setShowArrows] = useState(true);
  const [seed, setSeed] = useState(42);
  const [n, setN] = useState(1000);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const [realistic, setRealistic] = useState(false);

  const example = ALL.find(e => e.id === selId);
  const trueBeta = realistic ? example.realisticBeta : 0;
  const data = useMemo(() => generateData(example, n, seed, trueBeta), [example, n, seed, trueBeta]);
  const adjusted = useMemo(() => computeAdjusted(data), [data]);

  useEffect(() => { setConditioned(false); }, [selId]);
  useEffect(() => { if (!isNarrow) setDrawerOpen(false); }, [isNarrow]);

  return (
    <div style={{
      height:"100vh", background:"#faf9f7",
      fontFamily:"'Source Serif 4',Georgia,serif",
      display:"flex", flexDirection:"column",
      overflow:"hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet"/>

      {/* Header */}
      <header style={{
        padding: isMobile ? "8px 10px" : "10px 20px",
        borderBottom:"1px solid #e2e8f0", background:"#fff",
        display:"flex", alignItems:"center", gap: isMobile ? 8 : 12, flexShrink:0,
      }}>
        <button onClick={() => isNarrow ? setDrawerOpen(!drawerOpen) : setSideOpen(!sideOpen)} style={{
          background:"none", border:"1px solid #cbd5e1", borderRadius:6,
          padding:"4px 8px", cursor:"pointer", fontSize:14, color:"#475569", flexShrink:0,
        }}>☰</button>
        <h1 style={{ margin:0, fontSize: isMobile ? 14 : 18, fontWeight:700, color:"#0f172a", letterSpacing:-0.5, whiteSpace:"nowrap" }}>
          Don't Control For That!
        </h1>
        <div style={{ flex:1 }}/>
        {!isMobile && <span style={{ fontSize:10, color:"#64748b", flexShrink:0 }}>
          True β = <strong style={{ color: realistic ? "#16a34a" : "#64748b" }}>{trueBeta.toFixed(2)}</strong>
        </span>}
      </header>

      {/* Toolbar */}
      <div style={{
        padding: isMobile ? "6px 10px" : "8px 20px",
        borderBottom:"1px solid #e2e8f0", background:"#fefefe",
        display:"flex", alignItems:"center", gap: isMobile ? 6 : 14,
        flexWrap:"wrap", flexShrink:0,
      }}>
        <Toggle on={realistic} onToggle={() => setRealistic(!realistic)}
          leftLabel="Uncorrelated" rightLabel={isMobile ? "Realistic" : `Realistic (β=${example.realisticBeta.toFixed(2)})`}
          compact={isMobile}/>
        <div style={{ width:1, height:20, background:"#e2e8f0", flexShrink:0 }}/>
        <button onClick={() => setConditioned(!conditioned)} style={{
          padding: isMobile ? "4px 10px" : "5px 16px",
          fontSize: isMobile ? 11 : 12, fontWeight:700,
          fontFamily:"'Source Serif 4',Georgia,serif",
          border:"none", borderRadius:6, cursor:"pointer",
          background: conditioned ? "#dc2626" : "#0f172a", color:"#fff",
        }}>
          {conditioned ? "✕ Remove Control" : `Control for ${example.m.length>20 ? "M" : example.m}`}
        </button>
        {conditioned && (
          <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"#475569", cursor:"pointer", userSelect:"none" }}>
            <input type="checkbox" checked={showArrows} onChange={e => setShowArrows(e.target.checked)} style={{ accentColor:"#dc2626" }}/>
            {isMobile ? "↕" : "Arrows"}
          </label>
        )}
        <div style={{ width:1, height:20, background:"#e2e8f0", flexShrink:0 }}/>
        <button onClick={() => setSeed(s=>s+1)} style={{
          padding:"4px 10px", fontSize:11,
          fontFamily:"'Source Serif 4',Georgia,serif",
          border:"1px solid #cbd5e1", borderRadius:6, cursor:"pointer",
          background:"#fff", color:"#475569",
        }}>↻ Resample</button>
        <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"#64748b" }}>
          n=
          <input type="range" min={0} max={100} value={Math.round(Math.log10(n)/5*100)}
            onChange={e => {
              const t = Number(e.target.value)/100;
              const raw = Math.pow(10, t*5);
              const snapped = raw < 100 ? Math.round(raw/10)*10 : raw < 1000 ? Math.round(raw/50)*50 : raw < 10000 ? Math.round(raw/500)*500 : Math.round(raw/5000)*5000;
              setN(Math.max(10, Math.min(100000, snapped)));
            }} style={{ width: isMobile ? 50 : 80 }}/>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, minWidth:38 }}>{n >= 1000 ? (n/1000)+"k" : n}</span>
        </label>
      </div>

      {/* Body */}
      <div style={{ display:"flex", flex:1, overflow:"hidden", position:"relative" }}>
        {/* Drawer */}
        {isNarrow && drawerOpen && <>
          <div onClick={() => setDrawerOpen(false)}
            style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.3)", zIndex:30 }}/>
          <div style={{
            position:"fixed", top:0, left:0, bottom:0,
            width: isMobile ? "85vw" : 300, maxWidth:320,
            background:"#fff", zIndex:40, boxShadow:"4px 0 20px rgba(0,0,0,0.15)",
            overflow:"auto", display:"flex", flexDirection:"column",
          }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid #e2e8f0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:14, fontWeight:700, color:"#0f172a" }}>Examples</span>
              <button onClick={() => setDrawerOpen(false)} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"#64748b" }}>✕</button>
            </div>
            <div style={{ flex:1, overflow:"auto" }}>
              <SidebarContent selId={selId} setSelId={setSelId} onSelect={() => setDrawerOpen(false)}/>
            </div>
          </div>
        </>}

        {/* Sidebar */}
        {!isNarrow && (
          <nav style={{
            width: sideOpen ? 240 : 0, minWidth: sideOpen ? 240 : 0,
            overflow:"auto", borderRight: sideOpen ? "1px solid #e2e8f0" : "none",
            background:"#fff", transition:"width 0.15s, min-width 0.15s", flexShrink:0,
          }}>
            {sideOpen && <SidebarContent selId={selId} setSelId={setSelId}/>}
          </nav>
        )}

        {/* Main */}
        <main style={{
          flex:1, overflow:"auto",
          padding: isMobile ? "10px" : isNarrow ? "12px 16px" : "14px 24px",
        }}>
          {/* Story */}
          <div style={{ marginBottom: isMobile ? 8 : 10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
              <span style={{
                fontSize:9, fontWeight:700,
                color: example.type==="mbias" ? "#dc2626" : "#2563eb",
                textTransform:"uppercase", letterSpacing:1.5,
                background: example.type==="mbias" ? "#fef2f2" : "#eff6ff",
                padding:"1px 7px", borderRadius:6,
              }}>{example.type==="mbias" ? "M-Bias" : "Collider"}</span>
              <span style={{ fontSize: isMobile ? 15 : 18, fontWeight:700, color:"#0f172a" }}>{example.title}</span>
            </div>
            <p style={{ margin:0, fontSize: isMobile ? 11 : 12, color:"#475569", lineHeight:1.5 }}>
              {example.story}
              {realistic && <span style={{ color:"#16a34a", fontStyle:"italic" }}> Lit: {example.realisticCite}</span>}
            </p>
          </div>

          {/* Grid */}
          <div style={{
            display:"grid",
            gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
            gap: isMobile ? 8 : 12,
          }}>
            {/* DAG */}
            <div style={{ background:"#fff", borderRadius:8, border:"1px solid #e2e8f0", padding: isMobile ? 8 : 10 }}>
              <div style={{ fontSize:9, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>
                Causal Graph {realistic ? "(with true effect)" : "(β = 0 for clarity)"}
              </div>
              <div style={{ fontSize:8, color:"#94a3b8", marginBottom:4, lineHeight:1.3, fontStyle:"italic" }}>
                {example.pathsCite}
              </div>
              <DAG example={example} conditioned={conditioned} compact={true} hasDirectEffect={realistic}/>
            </div>

            {/* Scatter */}
            <div style={{ background:"#fff", borderRadius:8, border:"1px solid #e2e8f0", padding: isMobile ? 8 : 10 }}>
              <div style={{
                fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:4,
                color: conditioned ? "#dc2626" : "#64748b",
              }}>
                {conditioned ? "After \"Controlling\" — Y Shifts" : (realistic ? "Raw Data — True Effect" : "Raw Data — No Relationship")}
              </div>
              <ArrowScatter data={data} adjusted={adjusted} conditioned={conditioned}
                example={example} showArrows={showArrows} compact={true}/>
            </div>

            {/* Coefficients */}
            <div style={{
              gridColumn: isNarrow ? "1" : "1 / -1",
              background:"#fff", borderRadius:8, border:"1px solid #e2e8f0", padding: isMobile ? 8 : 10,
            }}>
              <div style={{ fontSize:9, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>
                Coefficient on {example.x}
              </div>
              <CoefBar data={data} conditioned={conditioned} example={example} compact={isMobile} trueBeta={trueBeta}/>
            </div>

            {/* Insight */}
            <div style={{
              gridColumn: isNarrow ? "1" : "1 / -1",
              padding: isMobile ? "8px 10px" : "10px 14px",
              borderRadius:6, fontSize: isMobile ? 10 : 11, lineHeight:1.5,
              color:"#1e293b",
              background: example.type==="mbias" ? "#fffbeb" : "#eff6ff",
              border: example.type==="mbias" ? "1px solid #fde68a" : "1px solid #bfdbfe",
            }}>
              <strong style={{ color: example.type==="mbias" ? "#92400e" : "#1e40af" }}>
                {example.type==="mbias" ? "Why dangerous: " : "Key insight: "}
              </strong>
              {example.type==="mbias"
                ? (realistic
                  ? `With true β = ${example.realisticBeta.toFixed(2)}, the no-controls estimate is roughly correct. Controlling for ${example.m} adds collider bias—the estimate shifts away from the real value. The numbers on the arrows show the structural relationships; the bias flows through the M-bias path.`
                  : `We set β = 0 so any signal is pure bias. "Controlling for ${example.m}" shifts each Y based on M; because M correlates with X through unobserved causes (see arrow weights), this manufactures a slope from nothing. Toggle "Realistic" to see how the bias distorts a real effect.`)
                : (realistic
                  ? `With true β = ${example.realisticBeta.toFixed(2)}, the no-controls estimate is close. Conditioning on ${example.m} adds collider bias, distorting the estimate. The arrow weights show how strongly X and Y each drive selection into C.`
                  : `We set β = 0 so any signal is pure bias. The numbers on the arrows show how strongly each cause drives the collider. Conditioning on ${example.m} manufactures a relationship. Toggle "Realistic" to see distortion of a real effect.`)}
            </div>

            <div style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: isMobile ? 13 : 14,
              lineHeight: 1.5,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#14532d",
            }}>
              You want to correct for confounders. You must not correct for colliders. But do you know which is which? Some variables are both! Observational causality may be harder than you think. That's ok. Have a coffee.
            </div>

            <div style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: isMobile ? 12 : 13,
              lineHeight: 1.5,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              color: "#64748b",
              textAlign: "center",
            }}>
              This app is brought to you by{" "}
              <a href="https://koerding.com" target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", textDecoration: "underline" }}>Konrad Kording</a>
              {" "}(<a href="https://c4r.io" target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", textDecoration: "underline" }}>Community for Rigor</a>)
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
