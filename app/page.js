'use client';

import { useEffect, useMemo, useState } from 'react';

const W = 8;
const H = 6;

const initialEnemies = [
  { id: 'a', q: 6, r: 1, hp: 10, max: 10, kind: 'marauder', name: '掠夺者' },
  { id: 'b', q: 5, r: 4, hp: 14, max: 14, kind: 'warden', name: '守卫者' },
];

const cards = [
  { id: 'stride', name: '踏步', cost: 1, kind: 'move', text: '移动 2 格。', tag: '移动' },
  { id: 'strike', name: '裂斩', cost: 1, kind: 'attack', text: '相邻敌人受到 5 伤害。', tag: '攻击' },
  { id: 'ember', name: '余烬', cost: 1, kind: 'attack2', text: '远程造成 3 伤害，并在目标脚下留下火焰。', tag: '攻击' },
  { id: 'dash', name: '冲刺', cost: 2, kind: 'dash', text: '移动 4 格；若结束在敌人旁边，造成 2 伤害。', tag: '移动' },
  { id: 'guard', name: '护势', cost: 1, kind: 'guard', text: '获得 5 护甲，本回合结束额外抽 1 张。', tag: '防御' },
  { id: 'burst', name: '爆燃', cost: 2, kind: 'burst', text: '引爆火焰：每个火焰格对相邻敌人造成 4 伤害。', tag: '地形' },
  { id: 'focus', name: '专注', cost: 0, kind: 'draw', text: '抽 2 张牌。', tag: '资源' },
  { id: 'pulse', name: '震荡', cost: 2, kind: 'aoe', text: '对距离 ≤2 的所有敌人造成 3 伤害。', tag: '范围' },
];

function key(q, r) {
  return `${q},${r}`;
}

function dist(a, b) {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs((a.q - a.r) - (b.q - b.r)),
  );
}

function shuffle(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

const neighborDirs = [
  { q: 1, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
  { q: 0, r: -1 },
  { q: 1, r: 1 },
  { q: -1, r: -1 },
];

function stepToward(from, target, occupied) {
  const candidates = neighborDirs
    .map((d) => ({ q: from.q + d.q, r: from.r + d.r }))
    .filter((p) => p.q >= 0 && p.q < W && p.r >= 0 && p.r < H)
    .filter((p) => !occupied.has(key(p.q, p.r)));

  candidates.sort((a, b) => dist(a, target) - dist(b, target));
  return candidates[0] && dist(candidates[0], target) < dist(from, target) ? candidates[0] : from;
}

export default function Home() {
  const [player, setPlayer] = useState({ q: 1, r: 3, hp: 20, max: 20, armor: 0 });
  const [enemies, setEnemies] = useState(initialEnemies);
  const [hazards, setHazards] = useState([]);
  const [deck, setDeck] = useState(() => shuffle(cards.flatMap((c) => [c.id, c.id, c.id, c.kind === 'burst' ? c.id : ''])) .filter(Boolean));
  const [hand, setHand] = useState([]);
  const [discard, setDiscard] = useState([]);
  const [energy, setEnergy] = useState(3);
  const [turn, setTurn] = useState(1);
  const [selected, setSelected] = useState(null);
  const [log, setLog] = useState(['战斗开始。敌人会在结束回合后追击。']);
  const [status, setStatus] = useState('playing');

  useEffect(() => {
    draw(5);
  }, []);

  function draw(n) {
    setHand((h) => {
      const hh = [...h];
      let d = [...deck];
      let dis = [...discard];
      for (let i = 0; i < n; i += 1) {
        if (!d.length) {
          d = shuffle(dis);
          dis = [];
        }
        if (!d.length) break;
        hh.push(d.pop());
      }
      setDeck(d);
      setDiscard(dis);
      return hh;
    });
  }

  function addLog(s) {
    setLog((l) => [s, ...l].slice(0, 8));
  }

  function blocked(q, r, movingEnemyId = null) {
    return (
      enemies.some((e) => e.id !== movingEnemyId && e.q === q && e.r === r && e.hp > 0) ||
      (player.q === q && player.r === r)
    );
  }

  function spend(card) {
    if (energy < card.cost) {
      addLog('能量不足。');
      return false;
    }
    setEnergy((e) => e - card.cost);
    return true;
  }

  function finish(card, msg) {
    setHand((h) => {
      const i = h.findIndex((x) => x === card.id);
      if (i < 0) return h;
      const next = [...h];
      next.splice(i, 1);
      setDiscard((d) => [...d, card.id]);
      return next;
    });
    addLog(msg);
    setSelected(null);
  }

  function play(card) {
    if (status !== 'playing') return;

    if (['move', 'dash', 'attack', 'attack2'].includes(card.kind)) {
      if (!spend(card)) return;
      setSelected(card);
      addLog(`${card.name}：${['move', 'dash'].includes(card.kind) ? '选择落点。' : '选择目标。'}`);
      return;
    }

    if (card.kind === 'guard') {
      if (!spend(card)) return;
      setPlayer((p) => ({ ...p, armor: p.armor + 5 }));
      finish(card, '获得 5 护甲。');
      return;
    }

    if (card.kind === 'draw') {
      if (!spend(card)) return;
      finish(card, '专注：抽 2 张。');
      setTimeout(() => draw(2), 0);
      return;
    }

    if (card.kind === 'burst') {
      if (!spend(card)) return;
      const damaged = enemies.filter((e) => e.hp > 0 && hazards.some((h) => dist(h, e) <= 1));
      setEnemies((es) => es.map((e) => (damaged.some((x) => x.id === e.id) ? { ...e, hp: e.hp - 4 } : e)));
      setHazards([]);
      finish(card, `爆燃：${damaged.length ? `命中 ${damaged.length} 个目标。` : '没有命中目标。'}`);
      checkVictory(enemies.map((e) => damaged.some((x) => x.id === e.id) ? { ...e, hp: e.hp - 4 } : e), player.hp);
      return;
    }

    if (card.kind === 'aoe') {
      if (!spend(card)) return;
      const nextEnemies = enemies.map((e) => (dist(player, e) <= 2 ? { ...e, hp: e.hp - 3 } : e));
      setEnemies(nextEnemies);
      finish(card, '震荡：范围内敌人受到 3 伤害。');
      checkVictory(nextEnemies, player.hp);
    }
  }

  function cell(q, r) {
    if (!selected || status !== 'playing') return;
    const c = selected;

    if (c.kind === 'move' || c.kind === 'dash') {
      const d = dist(player, { q, r });
      const max = c.kind === 'dash' ? 4 : 2;
      if (d > max || blocked(q, r)) {
        addLog('这个格子到不了。');
        return;
      }
      const pathHit = c.kind === 'dash' && enemies.some((e) => e.hp > 0 && dist(e, { q, r }) === 1);
      const nextEnemies = pathHit ? enemies.map((e) => (e.hp > 0 && dist(e, { q, r }) === 1 ? { ...e, hp: e.hp - 2 } : e)) : enemies;
      setPlayer((p) => ({ ...p, q, r }));
      setEnemies(nextEnemies);
      finish(c, `移动到 (${q + 1},${r + 1})${pathHit ? '，冲刺震击造成 2 伤害。' : '。'}`);
      checkVictory(nextEnemies, player.hp);
      return;
    }

    const t = enemies.find((e) => e.q === q && e.r === r && e.hp > 0);
    if (!t) {
      addLog('请选择敌人。');
      return;
    }
    if (c.kind === 'attack' && dist(player, t) !== 1) {
      addLog('裂斩只能攻击相邻目标。');
      return;
    }

    const amount = c.kind === 'attack' ? 5 : 3;
    const nextEnemies = enemies.map((e) => (e.id === t.id ? { ...e, hp: e.hp - amount } : e));
    setEnemies(nextEnemies);
    if (c.kind === 'attack2') {
      setHazards((h) => [...h.filter((x) => !(x.q === t.q && x.r === t.r)), { q: t.q, r: t.r }]);
    }
    finish(c, `${t.name} 受到 ${amount} 伤害。`);
    checkVictory(nextEnemies, player.hp);
  }

  function checkVictory(nextEnemies, nextHp) {
    if (nextEnemies.length && nextEnemies.every((e) => e.hp <= 0)) {
      setStatus('won');
      addLog('战斗胜利。');
    } else if (nextHp <= 0) {
      setStatus('lost');
      addLog('你倒下了。');
    }
  }

  function endTurn() {
    if (status !== 'playing') return;
    setSelected(null);

    const occupied = new Set([key(player.q, player.r)]);
    const moved = enemies
      .filter((e) => e.hp > 0)
      .reduce((acc, enemy) => {
        const currentOccupied = new Set([...occupied, ...acc.map((x) => key(x.q, x.r))]);
        const next = stepToward(enemy, player, currentOccupied);
        if (next.q !== enemy.q || next.r !== enemy.r) {
          addLog(`${enemy.name} 向你逼近。`);
        }
        return [...acc, { ...enemy, ...next }];
      }, []);

    const damage = moved.reduce((sum, e) => (dist(player, e) === 1 ? sum + (e.kind === 'warden' ? 2 : 3) : sum), 0);
    const blockedDamage = Math.min(damage, player.armor);
    const hpLoss = Math.max(0, damage - player.armor);
    const nextHp = Math.max(0, player.hp - hpLoss);

    setEnemies((es) => es.map((e) => moved.find((m) => m.id === e.id) || e));
    setPlayer((p) => ({ ...p, hp: nextHp, armor: 0 }));
    setTurn((t) => t + 1);
    setEnergy(3);
    addLog(
      damage
        ? `敌人行动：造成 ${damage} 伤害${blockedDamage ? `，护甲抵消 ${blockedDamage}。` : '。'}`
        : '敌人行动：未造成伤害。',
    );
    if (nextHp <= 0) {
      setStatus('lost');
      return;
    }

    const extraDraw = hand.length === 0 ? 2 : 1;
    setTimeout(() => draw(extraDraw), 0);
    if (extraDraw === 2) addLog('手牌耗尽：额外抽 1 张。');
  }

  const cells = useMemo(
    () => Array.from({ length: W * H }, (_, i) => ({ q: i % W, r: Math.floor(i / W) })),
    [],
  );

  const alive = enemies.filter((e) => e.hp > 0).length;
  const objective = status === 'won' ? '战斗胜利' : status === 'lost' ? '战斗失败' : '击败全部敌人';

  return (
    <div className="app">
      <header>
        <div>
          <div className="eyebrow">PROJECT FORGE #001</div>
          <h1>HEXBOUND <span>战场构筑原型</span></h1>
          <p>2D 角色 × 3D 六边形战场 × Deckbuilding</p>
        </div>
        <div className="metrics">
          <div>回合 <b>{turn}</b></div>
          <div>能量 <b>{energy}</b></div>
          <div>生命 <b>{player.hp}/{player.max}</b></div>
        </div>
      </header>

      <main>
        <section className="boardWrap">
          <div className="board">
            {cells.map((c) => {
              const enemy = enemies.find((x) => x.q === c.q && x.r === c.r && x.hp > 0);
              const isPlayer = player.q === c.q && player.r === c.r;
              const fire = hazards.some((h) => h.q === c.q && h.r === c.r);
              const d = dist(player, c);
              const targetingMove = selected && ['move', 'dash'].includes(selected.kind);
              const validMove = targetingMove && d <= (selected.kind === 'dash' ? 4 : 2) && !blocked(c.q, c.r);
              const validTarget = selected && ['attack', 'attack2'].includes(selected.kind) && enemy;
              return (
                <button
                  key={key(c.q, c.r)}
                  className={`hex ${fire ? 'fire ' : ''}${validMove ? 'movable ' : ''}${validTarget ? 'targetable ' : ''}`}
                  onClick={() => cell(c.q, c.r)}
                >
                  {isPlayer && <span className="unit hero">⚔<small>你</small></span>}
                  {enemy && (
                    <span className={`unit ${enemy.kind}`}>
                      {enemy.kind === 'warden' ? '◆' : '✦'}
                      <small>{Math.max(0, enemy.hp)}/{enemy.max}</small>
                    </span>
                  )}
                  <span className="coord">{String.fromCharCode(65 + c.q)}{c.r + 1}</span>
                </button>
              );
            })}
          </div>
          <div className="legend">◆ 守卫者　 ✦ 掠夺者　 🔥 火焰地形　 · 高亮格=当前可选目标</div>
        </section>

        <aside className="side">
          <div className="panel">
            <div className="panelTitle">当前目标</div>
            <div className="objective">{objective}<br /><span>{alive} 个单位存活 · 敌人会追击</span></div>
          </div>
          <div className="panel">
            <div className="panelTitle">战斗日志</div>
            <div className="log">{log.map((x, i) => <div key={`${x}-${i}`}>{x}</div>)}</div>
          </div>
          <button className="end" onClick={endTurn} disabled={status !== 'playing'}>
            {status === 'playing' ? '结束回合 →' : '重新开始 ↻'}
          </button>
          {status !== 'playing' && <button className="end" onClick={() => location.reload()}>重新开始战斗</button>}
        </aside>
      </main>

      <section className="handPanel">
        <div className="handTitle">
          <div><span className="eyebrow">DECKBUILDING</span><h2>手牌 <span>{hand.length}</span></h2></div>
          <div className="deckMeta">牌库 {deck.length} · 弃牌 {discard.length}</div>
        </div>
        <div className="hand">
          {hand.map((id, i) => {
            const card = cards.find((x) => x.id === id);
            return (
              <button
                className={`card ${selected?.id === card.id ? 'active' : ''}`}
                key={`${id}-${i}`}
                onClick={() => play(card)}
                disabled={energy < card.cost || status !== 'playing'}
              >
                <div className="cardTop"><span className="tag">{card.tag}</span><b>{card.cost}</b></div>
                <h3>{card.name}</h3>
                <p>{card.text}</p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
