'use client';

import { useState } from 'react';

const base = [
  { score: 94, title: 'Kaveri Foods — line expansion signal', why: 'A capacity expansion announcement aligns with new production-line hiring and a recent facilities permit.', tags: ['factory expansion','hiring spike','food processing'], evidence: ['Company announcement: capacity expansion','3 new production engineering roles posted','Facilities permit updated this month'], action: 'Research packaging line requirements and identify the procurement / engineering contact.' },
  { score: 88, title: 'Aruna Beverages — new filling capacity forming', why: 'Three independent signals suggest a new beverage line is moving from planning toward execution.', tags: ['new line','capex','beverages'], evidence: ['Local project notice','New utilities / plant engineering role','Supplier-related search activity'], action: 'Check likely equipment specifications and approach before a formal RFQ is published.' },
  { score: 81, title: 'Nova Nutrients — demand signal cluster', why: 'Import activity, product expansion and a new site role point to a potential processing upgrade window.', tags: ['import surge','product launch','site hiring'], evidence: ['Recent category import increase','New SKU expansion announcement','Plant operations hiring'], action: 'Validate whether the expansion requires filling or liquid-handling equipment.' }
];

export default function ESYRAPage() {
  const [market, setMarket] = useState('India');
  const [product, setProduct] = useState('Filling & packaging equipment');
  const [signal, setSignal] = useState('Factory expansion');
  const [list, setList] = useState(base);
  const [selected, setSelected] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [signalCount, setSignalCount] = useState(1842);
  const [opportunityCount, setOpportunityCount] = useState(17);

  const scan = () => {
    setScanning(true);
    window.setTimeout(() => {
      const next = base.map((o) => ({
        ...o,
        title: `${o.title} · ${market}`,
        why: `${o.why} ESYRA also weights the ${signal.toLowerCase()} signal against the selected product: ${product}.`
      }));
      setList(next);
      setSignalCount(1842 + Math.floor(Math.random() * 700));
      setOpportunityCount(17 + Math.floor(Math.random() * 8));
      setScanning(false);
    }, 900);
  };

  const chosen = selected ?? list[0];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html:`
      :root{--bg:#07090b;--panel:#0d1115;--line:#20272d;--text:#f3f5f7;--muted:#8d98a2}
      *{box-sizing:border-box}html,body{margin:0;background:radial-gradient(circle at 18% 8%,#12191c 0,#090c0f 32%,#07090b 72%);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
      body{min-height:100vh}.wrap{max-width:1240px;margin:0 auto;padding:24px 24px 64px}.nav{display:flex;align-items:center;justify-content:space-between;padding:6px 0 32px}.brand{letter-spacing:.18em;font-weight:700;font-size:14px}.nav small{color:var(--muted);letter-spacing:.08em}
      .hero{display:grid;grid-template-columns:1.05fr .95fr;gap:34px;align-items:center;padding:42px 0 34px}.eyebrow{color:var(--muted);font-size:12px;letter-spacing:.2em;text-transform:uppercase}.hero h1{font-size:clamp(48px,8vw,92px);line-height:.92;margin:14px 0 22px;letter-spacing:-.055em;font-weight:650}.hero p{font-size:20px;line-height:1.55;color:#b7c0c8;max-width:660px;margin:0}.quote{margin-top:28px;font-size:14px;color:#dce2e6;letter-spacing:.06em}
      .orb{height:470px;border:1px solid var(--line);border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.025),rgba(255,255,255,.005));position:relative;overflow:hidden;box-shadow:0 0 80px rgba(110,150,140,.08) inset}.orb:before{content:"";position:absolute;width:520px;height:520px;left:50%;top:50%;transform:translate(-50%,-50%);border:1px solid rgba(220,231,225,.15);border-radius:50%;box-shadow:0 0 80px rgba(220,231,225,.12)}.orb:after{content:"";position:absolute;width:240px;height:240px;left:50%;top:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(220,231,225,.2),rgba(220,231,225,0) 68%);filter:blur(6px)}.ray{position:absolute;left:50%;top:50%;height:1px;width:74%;background:linear-gradient(90deg,transparent,rgba(220,231,225,.22),transparent)}.r1{transform:translate(-50%,-50%) rotate(13deg)}.r2{transform:translate(-50%,-50%) rotate(-37deg)}.r3{transform:translate(-50%,-50%) rotate(63deg)}.core{position:absolute;left:50%;top:50%;width:12px;height:12px;border-radius:50%;transform:translate(-50%,-50%);background:#eaf4ee;box-shadow:0 0 28px rgba(234,244,238,.8)}
      .panel{background:rgba(13,17,21,.86);border:1px solid var(--line);border-radius:20px;padding:22px}.panel h2{font-size:16px;margin:0 0 6px}.sub{color:var(--muted);font-size:13px;margin-bottom:20px}.controls{display:grid;grid-template-columns:1.2fr 1fr 1fr auto;gap:10px;margin-bottom:18px}.control{width:100%;background:#0a0e11;border:1px solid #242b31;border-radius:12px;color:#eef1f3;padding:13px 14px;font:inherit;outline:none}.btn{border:1px solid #e8efeb;background:#e8efeb;color:#0a0d0f;border-radius:12px;padding:12px 18px;font-weight:700;cursor:pointer}.btn:disabled{opacity:.6;cursor:wait}.scanline{height:8px;border-radius:99px;background:#171d22;overflow:hidden;margin:12px 0 18px;opacity:0}.scanline.active{opacity:1}.scanline span{display:block;height:100%;width:30%;background:linear-gradient(90deg,transparent,#dce7e1,transparent);animation:scan 1.1s infinite}@keyframes scan{from{transform:translateX(-130%)}to{transform:translateX(350%)}}
      .opps{display:grid;gap:12px}.opp{padding:16px;border:1px solid #20282e;border-radius:16px;background:linear-gradient(180deg,#0f1418,#0a0e11);cursor:pointer;transition:.2s}.opp:hover{border-color:#46515a;transform:translateY(-1px)}.opp-top{display:flex;justify-content:space-between;gap:16px}.sig{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#93a19a}.opp h3{margin:8px 0 7px;font-size:17px}.opp p{margin:0;color:#aab4bc;font-size:13px;line-height:1.55}.score{font-size:14px;font-weight:700;padding:8px 10px;border-radius:10px;background:#151c20;min-width:55px;text-align:center}.score.high{color:#e8f4ed}.meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.pill{font-size:11px;color:#9eabb4;border:1px solid #263038;border-radius:999px;padding:5px 8px}
      .grid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;margin-top:18px}.side .stat{display:flex;align-items:end;justify-content:space-between;border-bottom:1px solid var(--line);padding:18px 0}.num{font-size:32px;letter-spacing:-.04em}.label{font-size:12px;color:var(--muted);margin-top:4px}.sidebox{margin-top:18px;padding:16px;border:1px dashed #29323a;border-radius:16px;background:#0a0e11}.sidebox strong{display:block;margin-bottom:7px}.sidebox p{margin:0;color:#9ca7ae;line-height:1.5;font-size:13px}.flow{margin-top:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.step{background:#0d1216;border:1px solid #20272d;border-radius:14px;padding:14px}.step b{display:block;font-size:12px;margin-bottom:6px}.step span{color:#88949d;font-size:11px;line-height:1.4}.footer{display:flex;justify-content:space-between;gap:20px;margin-top:28px;color:#5f6971;font-size:11px;letter-spacing:.04em}
      @media(max-width:900px){.hero,.grid{grid-template-columns:1fr}.orb{height:300px}.controls{grid-template-columns:1fr 1fr}.controls .btn{grid-column:1/-1}.flow{grid-template-columns:1fr 1fr}.footer{flex-direction:column}}
      `}} />
      <div className="wrap">
        <div className="nav"><div className="brand">ESYRA</div><small>AI OPPORTUNITY INTELLIGENCE</small></div>
        <section className="hero"><div><div className="eyebrow">A machine that notices</div><h1>Notice what<br/>others miss.</h1><p>ESYRA watches the changing world for weak signals, connects them, verifies the evidence, and surfaces the opportunities that deserve human attention.</p><div className="quote">Signal → Relation → Emergence → Opportunity → Action</div></div><div className="orb"><div className="ray r1"/><div className="ray r2"/><div className="ray r3"/><div className="core"/></div></section>
        <section className="panel"><h2>Opportunity Radar</h2><div className="sub">Prototype lens: India · food processing &amp; liquid packaging · pre-procurement signals</div><div className="controls"><input className="control" value={product} onChange={e=>setProduct(e.target.value)} aria-label="Product"/><select className="control" value={market} onChange={e=>setMarket(e.target.value)}><option>India</option><option>Vietnam</option><option>Indonesia</option><option>UAE</option></select><select className="control" value={signal} onChange={e=>setSignal(e.target.value)}><option>Factory expansion</option><option>New production line</option><option>Hiring spike</option><option>Import surge</option></select><button className="btn" onClick={scan} disabled={scanning}>{scanning?'Scanning…':'Scan reality'}</button></div><div className={`scanline ${scanning?'active':''}`}><span/></div><div className="opps">{list.map((o,i)=><div className="opp" key={i} onClick={()=>setSelected(o)}><div className="opp-top"><div><div className="sig">Opportunity {String(i+1).padStart(2,'0')}</div><h3>{o.title}</h3></div><div className={`score ${o.score>89?'high':''}`}>{o.score}</div></div><p>{o.why}</p><div className="meta">{o.tags.map(t=><span className="pill" key={t}>{t}</span>)}</div></div>)}</div></section>
        <div className="grid"><section className="panel"><h2>Why ESYRA thinks this matters</h2><div className="sub">The system never presents “AI says so” as evidence.</div><div className="sidebox"><strong>{chosen.title}</strong><p style={{marginTop:8}}><span style={{color:'#d7e0da'}}>Inference:</span> {chosen.why}</p><p style={{marginTop:12}}><span style={{color:'#d7e0da'}}>Evidence chain:</span> {chosen.evidence.map((x,i)=><span key={i}><br/>• {x}</span>)}</p><p style={{marginTop:12}}><span style={{color:'#d7e0da'}}>Recommended action:</span> {chosen.action}</p></div><div className="flow"><div className="step"><b>01 Observe</b><span>Watch companies, projects, people, markets.</span></div><div className="step"><b>02 Connect</b><span>Relate weak signals across sources.</span></div><div className="step"><b>03 Verify</b><span>Attach evidence and confidence.</span></div><div className="step"><b>04 Surface</b><span>Rank what may become valuable.</span></div><div className="step"><b>05 Act</b><span>Give a human the next move.</span></div></div></section>
          <aside className="panel side"><h2>ESYRA signal state</h2><div className="sub">Demo numbers — illustrative</div><div className="stat"><div><div className="num">{signalCount.toLocaleString()}</div><div className="label">signals observed</div></div><div className="sig">today</div></div><div className="stat"><div><div className="num">{opportunityCount}</div><div className="label">opportunities surfaced</div></div><div className="sig">ranked</div></div><div className="stat"><div><div className="num">92%</div><div className="label">evidence coverage</div></div><div className="sig">target</div></div><div className="sidebox"><strong>Not a lead list.</strong><p>ESYRA is designed to detect why a company may become worth contacting — before the request looks like a conventional lead.</p></div></aside>
        </div>
        <div className="footer"><span>ESYRA / prototype concept</span><span>Reveal, don't dictate.</span></div>
      </div>
    </>
  );
}
