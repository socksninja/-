'use client';

import { useMemo, useState } from 'react';

const W = 8;
const H = 6;
const BASE_ENERGY = 4;

const CARD_LIBRARY = [
  { id: 'strike', name: '裂斩', cost: 1, kind: 'attack', text: '相邻敌人受到 5 伤害。', tag: '近战' },
  { id: 'ember', name: '余烬', cost: 1, kind: 'fire', text: '远程造成 3 伤害，并在目标格留下火焰。', tag: '火焰' },
  { id: 'guard', name: '护势', cost: 1, kind: 'guard', text: '获得 5 护甲。', tag: '防御' },
  { id: 'burst', name: '爆燃', cost: 2, kind: 'burst', text: '引爆所有火焰：相邻敌人受到 4 伤害。', tag: '火焰' },
  { id: 'arc', name: '电弧冲击', cost: 1, kind: 'arc', text: '远程造成 2 伤害；命中火焰上的敌人时触发引燃。', tag: '引燃' },
  { id: 'charge', name: '蓄势', cost: 1, kind: 'charge', text: '获得 4 点蓄势，使下一次攻击额外 +4。', tag: '爆发' },
  { id: 'shove', name: '推击', cost: 1, kind: 'shove', text: '相邻敌人受到 3 伤害并被推开 1 格。', tag: '空间' },
  { id: 'focus', name: '专注', cost: 0, kind: 'draw', text: '抽 2 张牌。', tag: '资源' },
];

const STARTER_IDS = ['strike', 'strike', 'ember', 'guard', 'focus', 'burst', 'arc', 'shove'];
const REWARD_IDS = ['arc', 'charge', 'shove', 'ember', 'burst'];
const neighborDirs = [
  { q: 1, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 1 },
  { q: 0, r: -1 }, { q: 1, r: 1 }, { q: -1, r: -1 },
];

function key(q, r) { return `${q},${r}`; }
function dist(a, b) {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs((a.q - a.r) - (b.q - b.r)));
}
function shuffle(items) {
  const x = [...items];
  for (let i = x.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}
function card(id) { return CARD_LIBRARY.find((item) => item.id === id); }
function makeDeck(extraIds) { return shuffle([...STARTER_IDS, ...extraIds]); }
function drawFromState(state, amount) {
  let deck = [...state.deck];
  let discard = [...state.discard];
  const hand = [...state.hand];
  for (let i = 0; i < amount; i += 1) {
    if (!deck.length && discard.length) { deck = shuffle(discard); discard = []; }
    if (!deck.length) break;
    hand.push(deck.pop());
  }
  return { deck, hand, discard };
}
function freshEnemies(stage = 1) {
  return [
    { id: 'a', q: 6, r: 1, hp: stage >= 3 ? 12 : 10, max: stage >= 3 ? 12 : 10, kind: 'marauder', name: '掠夺者', damage: 3 },
    { id: 'b', q: 5, r: 4, hp: stage >= 3 ? 16 : 14, max: stage >= 3 ? 16 : 14, kind: 'warden', name: '守卫者', damage: 2 },
    ...(stage >= 2 ? [{ id: 'c', q: 7, r: 4, hp: 18, max: 18, kind: 'elite', name: '精英猎手', damage: 4, chargeReady: false }] : []),
  ];
}
function intentFor(enemy, player) {
  const d = dist(enemy, player);
  if (enemy.kind === 'elite') {
    if (enemy.chargeReady) return { type: '冲锋释放', icon: '⚡', detail: '下回合沿直线冲撞' };
    if (d <= 1) return { type: '重击', icon: '⚔', detail: `攻击 ${enemy.damage + 2} 点` };
    if (d <= 4) return { type: '冲锋蓄力', icon: '⚡', detail: '下回合冲撞' };
    return { type: '逼近', icon: '👣', detail: '移动 1 格' };
  }
  if (enemy.kind === 'warden') {
    if (d <= 2) return { type: '投掷', icon: '◆', detail: `${enemy.damage} 远程伤害` };
    return { type: '蓄力移动', icon: '◇', detail: '移动 1 格' };
  }
  if (d <= 1) return { type: '近战攻击', icon: '⚔', detail: `${enemy.damage} 伤害` };
  return { type: '逼近', icon: '👣', detail: '移动 1 格' };
}
function stepToward(from, target, occupied) {
  const candidates = neighborDirs
    .map((d) => ({ q: from.q + d.q, r: from.r + d.r }))
    .filter((p) => p.q >= 0 && p.q < W && p.r >= 0 && p.r < H)
    .filter((p) => !occupied.has(key(p.q, p.r)));
  candidates.sort((a, b) => dist(a, target) - dist(b, target));
  return candidates[0] && dist(candidates[0], target) < dist(from, target) ? candidates[0] : from;
}
function initialCards() {
  const deck = makeDeck([]);
  return { deck: deck.slice(0, -5), hand: deck.slice(-5), discard: [] };
}

export default function Home() {
  const [player, setPlayer] = useState({ q: 1, r: 3, hp: 20, max: 20, armor: 0, momentum: 0, charge: 0 });
  const [enemies, setEnemies] = useState(() => freshEnemies(1));
  const [hazards, setHazards] = useState([]);
  const [cardsState, setCardsState] = useState(() => initialCards());
  const [extraIds, setExtraIds] = useState([]);
  const [energy, setEnergy] = useState(BASE_ENERGY);
  const [turn, setTurn] = useState(1);
  const [movedThisTurn, setMovedThisTurn] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('playing');
  const [rewardOptions, setRewardOptions] = useState([]);
  const [stage, setStage] = useState(1);
  const [log, setLog] = useState(['战斗开始。移动已成为每回合常驻行动。']);

  const cells = useMemo(() => Array.from({ length: W * H }, (_, i) => ({ q: i % W, r: Math.floor(i / W) })), []);
  const alive = enemies.filter((enemy) => enemy.hp > 0).length;

  function addLog(message) { setLog((current) => [message, ...current].slice(0, 9)); }
  function spend(cost) {
    if (energy < cost) { addLog('能量不足。'); return false; }
    setEnergy((current) => current - cost); return true;
  }
  function discardCard(id) {
    setCardsState((state) => {
      const index = state.hand.findIndex((item) => item === id);
      if (index < 0) return state;
      const hand = [...state.hand]; hand.splice(index, 1);
      return { ...state, hand, discard: [...state.discard, id] };
    });
  }
  function draw(amount) { setCardsState((state) => drawFromState(state, amount)); }
  function finish(cardData, message) { discardCard(cardData.id); setSelected(null); addLog(message); }
  function startMove() {
    if (status !== 'playing') return;
    if (movedThisTurn) { addLog('本回合已经行动过移动。'); return; }
    setSelected(null); setMoveMode(true); addLog('选择一个落点移动 2 格；移动后获得 1 层蓄力。');
  }
  function blocked(q, r) {
    return (player.q === q && player.r === r) || enemies.some((enemy) => enemy.hp > 0 && enemy.q === q && enemy.r === r);
  }
  function checkVictory(nextEnemies, nextHp) {
    if (nextHp <= 0) { setStatus('lost'); addLog('你倒下了。'); return true; }
    if (nextEnemies.length && nextEnemies.every((enemy) => enemy.hp <= 0)) {
      const choices = shuffle(REWARD_IDS).slice(0, 3).map((id) => card(id));
      setRewardOptions(choices); setStatus('reward'); addLog('战斗胜利：选择一张卡加入构筑。'); return true;
    }
    return false;
  }
  function play(cardData) {
    if (status !== 'playing') return;
    if (cardData.kind === 'fire' || cardData.kind === 'arc' || cardData.kind === 'shove') {
      if (!spend(cardData.cost)) return;
      setSelected(cardData); addLog(`${cardData.name}：选择目标。`); return;
    }
    if (cardData.cost && !spend(cardData.cost)) return;
    if (cardData.kind === 'guard') { setPlayer((p) => ({ ...p, armor: p.armor + 5 })); finish(cardData, '获得 5 护甲。'); return; }
    if (cardData.kind === 'charge') { setPlayer((p) => ({ ...p, charge: 4 })); finish(cardData, '蓄势完成：下一次攻击 +4。'); return; }
    if (cardData.kind === 'draw') { finish(cardData, '专注：抽 2 张。'); draw(2); return; }
    if (cardData.kind === 'burst') {
      const nextEnemies = enemies.map((enemy) => hazards.some((hazard) => dist(hazard, enemy) <= 1) ? { ...enemy, hp: enemy.hp - 4 - player.charge } : enemy);
      setEnemies(nextEnemies); setHazards([]); setPlayer((p) => ({ ...p, charge: 0, momentum: 0 })); finish(cardData, '爆燃：火焰全部引爆。'); checkVictory(nextEnemies, player.hp); return;
    }
  }
  function cell(q, r) {
    if (status !== 'playing') return;
    if (moveMode) {
      const target = { q, r };
      if (movedThisTurn || dist(player, target) > 2 || blocked(q, r)) { addLog('这个落点不可用。'); return; }
      setPlayer((p) => ({ ...p, q, r, momentum: Math.min(2, p.momentum + 1), charge: 0 }));
      setMovedThisTurn(true); setMoveMode(false); addLog(`移动到 (${q + 1},${r + 1})，蓄力 +1。`); return;
    }
    if (!selected) return;
    const selectedCard = selected;
    const target = enemies.find((enemy) => enemy.hp > 0 && enemy.q === q && enemy.r === r);
    if (!target) { addLog('请选择敌人。'); return; }
    if (selectedCard.kind === 'attack' && dist(player, target) !== 1) { addLog('裂斩只能攻击相邻目标。'); return; }
    if (selectedCard.kind === 'shove' && dist(player, target) !== 1) { addLog('推击只能攻击相邻目标。'); return; }
    let amount = selectedCard.kind === 'fire' ? 3 : selectedCard.kind === 'arc' ? 2 : 3;
    amount += player.momentum + player.charge;
    let nextEnemies = enemies.map((enemy) => enemy.id === target.id ? { ...enemy, hp: enemy.hp - amount } : enemy);
    const killed = target.hp > 0 && nextEnemies.find((enemy) => enemy.id === target.id)?.hp <= 0;
    if (selectedCard.kind === 'shove') {
      const occupied = new Set([key(player.q, player.r), ...nextEnemies.filter((e) => e.hp > 0 && e.id !== target.id).map((e) => key(e.q, e.r))]);
      const pushed = stepToward(target, { q: target.q + (target.q - player.q), r: target.r + (target.r - player.r) }, occupied);
      nextEnemies = nextEnemies.map((enemy) => enemy.id === target.id ? { ...enemy, ...pushed } : enemy);
    }
    if (killed) setEnergy((current) => current + 1);
    setEnemies(nextEnemies); setPlayer((p) => ({ ...p, momentum: 0, charge: 0 }));
    if (selectedCard.kind === 'fire') {
      setHazards((current) => [...current.filter((h) => !(h.q === target.q && h.r === target.r)), { q: target.q, r: target.r }]);
    }
    if (selectedCard.kind === 'arc' && hazards.some((h) => h.q === target.q && h.r === target.r)) {
      nextEnemies = nextEnemies.map((enemy) => enemy.id === target.id ? { ...enemy, hp: enemy.hp - 3 } : enemy);
      setEnemies(nextEnemies); setHazards((current) => current.filter((h) => !(h.q === target.q && h.r === target.r))); addLog('引燃：额外 3 伤害并清除火焰。');
    }
    finish(selectedCard, `${target.id === 'a' ? '敌人' : '目标'} 受到 ${amount} 伤害。`);
    checkVictory(nextEnemies, player.hp);
  }
  function endTurn() {
    if (status !== 'playing') return;
    setSelected(null); setMoveMode(false);
    let nextEnemies = enemies.map((enemy) => ({ ...enemy }));
    const occupied = new Set([key(player.q, player.r)]);
    nextEnemies.forEach((enemy) => { if (enemy.hp > 0) occupied.add(key(enemy.q, enemy.r)); });
    let damage = 0;
    nextEnemies = nextEnemies.map((enemy) => {
      if (enemy.hp <= 0) return enemy;
      if (enemy.chargeReady) {
        if (dist(enemy, player) <= 3) damage += enemy.damage + 2;
        return { ...enemy, chargeReady: false };
      }
      const intent = intentFor(enemy, player);
      if (intent.type === '近战攻击' || intent.type === '重击') { if (dist(enemy, player) === 1) damage += intent.damage; return enemy; }
      if (intent.type === '投掷' && dist(enemy, player) <= 2) { damage += enemy.damage; return enemy; }
      if (intent.type === '冲锋蓄力') return { ...enemy, chargeReady: true };
      const moved = stepToward(enemy, player, new Set([...occupied, ...nextEnemies.filter((other) => other.id !== enemy.id && other.hp > 0).map((other) => key(other.q, other.r))]));
      return { ...enemy, ...moved };
    });
    const blockedDamage = Math.min(player.armor, damage);
    const hpLoss = Math.max(0, damage - player.armor);
    const nextHp = Math.max(0, player.hp - hpLoss);
    setEnemies(nextEnemies); setPlayer((p) => ({ ...p, hp: nextHp, armor: 0, momentum: 0, charge: 0 }));
    setTurn((t) => t + 1); setEnergy(BASE_ENERGY); setMovedThisTurn(false); draw(1);
    addLog(damage ? `敌人行动：造成 ${damage} 伤害${blockedDamage ? `，护甲抵消 ${blockedDamage}。` : '。'}` : '敌人行动：未造成伤害。');
    checkVictory(nextEnemies, nextHp);
  }
  function chooseReward(chosen) {
    const newExtra = [...extraIds, chosen.id];
    const deck = makeDeck(newExtra);
    setExtraIds(newExtra); setCardsState({ deck: deck.slice(0, -5), hand: deck.slice(-5), discard: [] });
    setRewardOptions([]); setStatus('playing'); setStage((s) => s + 1); setEnemies(freshEnemies(stage + 1)); setHazards([]); setTurn(1); setEnergy(BASE_ENERGY); setMovedThisTurn(false); setMoveMode(false); setSelected(null);
    setPlayer((p) => ({ ...p, q: 1, r: 3, armor: 0, momentum: 0, charge: 0 })); addLog(`加入【${chosen.name}】。下一战开始。`);
  }
  function restart() { window.location.reload(); }

  return (
    <div className="app">
      <header>
        <div><div className="eyebrow">PROJECT FORGE #001 · V0.4 MOBILE</div><h1>HEXBOUND <span>战场构筑实验</span></h1><p>常驻移动 × 意图 × 火焰 × 构筑</p></div>
        <div className="metrics"><div>战斗 <b>{stage}</b></div><div>回合 <b>{turn}</b></div><div>能量 <b>{energy}</b></div><div>生命 <b>{player.hp}/{player.max}</b></div></div>
      </header>
      <main>
        <section className="boardWrap">
          <div className="board">
            {cells.map((c) => {
              const enemy = enemies.find((item) => item.hp > 0 && item.q === c.q && item.r === c.r);
              const isPlayer = player.q === c.q && player.r === c.r;
              const fire = hazards.some((hazard) => hazard.q === c.q && hazard.r === c.r);
              const validMove = moveMode && !movedThisTurn && dist(player, c) <= 2 && !blocked(c.q, c.r);
              const targetable = selected && ['fire', 'arc', 'shove'].includes(selected.kind) && enemy;
              const row = c.r % 2;
              return <button key={key(c.q, c.r)} className={`hex row-${row} ${fire ? 'fire ' : ''}${validMove ? 'movable ' : ''}${targetable ? 'targetable ' : ''}`} onClick={() => cell(c.q, c.r)}>
                <span className="coord">{c.q + 1},{c.r + 1}</span>
                {fire && <span className="hazardMark">✦</span>}
                {isPlayer && <div className="unit hero"><span>◆</span><b className="hpLabel">{player.hp}/{player.max}</b></div>}
                {enemy && <div className={`unit ${enemy.kind}`}><span>{enemy.kind === 'marauder' ? '⚔' : enemy.kind === 'warden' ? '◈' : '✦'}</span><b className="hpLabel">{Math.max(0, enemy.hp)}/{enemy.max}</b><em>{intentFor(enemy, player).icon} {intentFor(enemy, player).type}</em></div>}
              </button>;
            })}
          </div>
          <div className="legend">绿色 = 可移动 · 橙色 = 火焰 · 敌人上方 = 下一行动 · 移动为常驻行动，每回合一次</div>
        </section>
        <aside className="side">
          <div className="panel"><div className="panelTitle">OBJECTIVE</div><div className="objective">击败全部敌人 · {alive} 名存活</div><div className="deckMeta">构筑新增 {extraIds.length} 张 · 蓄力 {player.momentum}/2 · 蓄势 {player.charge}/4</div></div>
          <div className="panel"><div className="panelTitle">COMBAT LOG</div><div className="log">{log.map((item, i) => <div key={`${item}-${i}`}>{item}</div>)}</div></div>
          <div className="actionRow"><button className={`moveAction ${movedThisTurn ? 'used' : ''}`} onClick={startMove} disabled={status !== 'playing' || movedThisTurn} aria-label="移动 2 格"><span>移动</span></button><button className="end" onClick={endTurn} disabled={status !== 'playing'}>结束回合 →</button></div>
        </aside>
      </main>
      <section className="handPanel"><div className="handTitle"><div><div className="panelTitle">HAND</div><h2>你的手牌 <span>{cardsState.hand.length} 张</span></h2></div><div className="deckMeta">牌堆 {cardsState.deck.length} · 弃牌 {cardsState.discard.length}</div></div><div className="hand">{cardsState.hand.map((id, index) => { const c = card(id); return <button key={`${id}-${index}`} className={`card ${selected?.id === id ? 'active' : ''}`} disabled={status !== 'playing' || c.cost > energy} onClick={() => play(c)}><div className="cardTop"><span className="tag">{c.tag}</span><b>{c.cost}</b></div><h3>{c.name}</h3><p>{c.text}</p></button>; })}</div></section>
      {status === 'reward' && <div className="modalLayer"><div className="rewardModal"><div className="panelTitle">VICTORY REWARD</div><h2>选择一张卡加入构筑</h2><p>移动已经固定为基础行动，奖励只强化战斗与构筑。</p><div className="rewardGrid">{rewardOptions.map((c) => <button key={c.id} className="rewardCard" onClick={() => chooseReward(c)}><div className="cardTop"><span className="tag">{c.tag}</span><b>{c.cost}</b></div><h3>{c.name}</h3><p>{c.text}</p><span className="rewardHint">加入后影响下一场起手</span></button>)}</div></div></div>}
      {status === 'lost' && <div className="modalLayer"><div className="rewardModal"><div className="panelTitle">DEFEAT</div><h2>战斗失败</h2><p>再试一次。</p><button className="end restart" onClick={restart}>重新开始</button></div></div>}
    </div>
  );
}
