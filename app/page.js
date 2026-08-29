'use client';

import { useMemo, useState } from 'react';

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

function shuffle(items) {
  const x = [...items];
  for (let i = x.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

function makeDeck() {
  return shuffle(cards.flatMap((card) => [card.id, card.id, card.id]));
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

function drawFromState(state, amount) {
  let deck = [...state.deck];
  let discard = [...state.discard];
  const hand = [...state.hand];

  for (let i = 0; i < amount; i += 1) {
    if (!deck.length) {
      deck = shuffle(discard);
      discard = [];
    }
    if (!deck.length) break;
    hand.push(deck.pop());
  }

  return { deck, hand, discard };
}

export default function Home() {
  const [player, setPlayer] = useState({ q: 1, r: 3, hp: 20, max: 20, armor: 0 });
  const [enemies, setEnemies] = useState(initialEnemies);
  const [hazards, setHazards] = useState([]);
  const [cardsState, setCardsState] = useState(() => {
    const deck = makeDeck();
    return { deck: deck.slice(0, -5), hand: deck.slice(-5), discard: [] };
  });
  const [energy, setEnergy] = useState(3);
  const [turn, setTurn] = useState(1);
  const [selected, setSelected] = useState(null);
  const [log, setLog] = useState(['战斗开始。5 张起始手牌已准备。']);
  const [status, setStatus] = useState('playing');

  function addLog(message) {
    setLog((current) => [message, ...current].slice(0, 8));
  }

  function spend(card) {
    if (energy < card.cost) {
      addLog('能量不足。');
      return false;
    }
    setEnergy((current) => current - card.cost);
    return true;
  }

  function discardCard(cardId) {
    setCardsState((state) => {
      const index = state.hand.findIndex((id) => id === cardId);
      if (index < 0) return state;
      const hand = [...state.hand];
      hand.splice(index, 1);
      return { ...state, hand, discard: [...state.discard, cardId] };
    });
  }

  function draw(amount) {
    setCardsState((state) => drawFromState(state, amount));
  }

  function checkVictory(nextEnemies, nextHp) {
    if (nextEnemies.length && nextEnemies.every((enemy) => enemy.hp <= 0)) {
      setStatus('won');
      addLog('战斗胜利。');
    } else if (nextHp <= 0) {
      setStatus('lost');
      addLog('你倒下了。');
    }
  }

  function finishCard(card, message) {
    discardCard(card.id);
    setSelected(null);
    addLog(message);
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
      setPlayer((current) => ({ ...current, armor: current.armor + 5 }));
      finishCard(card, '获得 5 护甲。');
      return;
    }

    if (card.kind === 'draw') {
      if (!spend(card)) return;
      finishCard(card, '专注：抽 2 张。');
      draw(2);
      return;
    }

    if (card.kind === 'burst') {
      if (!spend(card)) return;
      const nextEnemies = enemies.map((enemy) =>
        hazards.some((hazard) => dist(hazard, enemy) <= 1)
          ? { ...enemy, hp: enemy.hp - 4 }
          : enemy,
      );
      const hits = nextEnemies.filter((enemy, index) => enemy.hp !== enemies[index].hp).length;
      setEnemies(nextEnemies);
      setHazards([]);
      finishCard(card, `爆燃：${hits ? `命中 ${hits} 个目标。` : '没有命中目标。'}`);
      checkVictory(nextEnemies, player.hp);
      return;
    }

    if (card.kind === 'aoe') {
      if (!spend(card)) return;
      const nextEnemies = enemies.map((enemy) =>
        dist(player, enemy) <= 2 ? { ...enemy, hp: enemy.hp - 3 } : enemy,
      );
      setEnemies(nextEnemies);
      finishCard(card, '震荡：范围内敌人受到 3 伤害。');
      checkVictory(nextEnemies, player.hp);
    }
  }

  function blocked(q, r) {
    return (
      enemies.some((enemy) => enemy.q === q && enemy.r === r && enemy.hp > 0) ||
      (player.q === q && player.r === r)
    );
  }

  function cell(q, r) {
    if (!selected || status !== 'playing') return;
    const card = selected;

    if (card.kind === 'move' || card.kind === 'dash') {
      const distance = dist(player, { q, r });
      const maxDistance = card.kind === 'dash' ? 4 : 2;
      if (distance > maxDistance || blocked(q, r)) {
        addLog('这个格子到不了。');
        return;
      }

      const nextEnemies = card.kind === 'dash'
        ? enemies.map((enemy) =>
            enemy.hp > 0 && dist(enemy, { q, r }) === 1
              ? { ...enemy, hp: enemy.hp - 2 }
              : enemy,
          )
        : enemies;
      const hit = nextEnemies.some((enemy, index) => enemy.hp !== enemies[index].hp);

      setPlayer((current) => ({ ...current, q, r }));
      setEnemies(nextEnemies);
      finishCard(card, `移动到 (${q + 1},${r + 1})${hit ? '，冲刺震击造成 2 伤害。' : '。'}`);
      checkVictory(nextEnemies, player.hp);
      return;
    }

    const target = enemies.find((enemy) => enemy.q === q && enemy.r === r && enemy.hp > 0);
    if (!target) {
      addLog('请选择敌人。');
      return;
    }
    if (card.kind === 'attack' && dist(player, target) !== 1) {
      addLog('裂斩只能攻击相邻目标。');
      return;
    }

    const amount = card.kind === 'attack' ? 5 : 3;
    const nextEnemies = enemies.map((enemy) =>
      enemy.id === target.id ? { ...enemy, hp: enemy.hp - amount } : enemy,
    );
    setEnemies(nextEnemies);
    if (card.kind === 'attack2') {
      setHazards((current) => [
        ...current.filter((hazard) => !(hazard.q === target.q && hazard.r === target.r)),
        { q: target.q, r: target.r },
      ]);
    }
    finishCard(card, `${target.name} 受到 ${amount} 伤害。`);
    checkVictory(nextEnemies, player.hp);
  }

  function endTurn() {
    if (status !== 'playing') return;
    setSelected(null);

    const occupied = new Set([key(player.q, player.r)]);
    const moved = enemies
      .filter((enemy) => enemy.hp > 0)
      .reduce((acc, enemy) => {
        const currentOccupied = new Set([
          ...occupied,
          ...acc.map((item) => key(item.q, item.r)),
        ]);
        const next = stepToward(enemy, player, currentOccupied);
        if (next.q !== enemy.q || next.r !== enemy.r) addLog(`${enemy.name} 向你逼近。`);
        return [...acc, { ...enemy, ...next }];
      }, []);

    const damage = moved.reduce(
      (sum, enemy) => sum + (dist(player, enemy) === 1 ? (enemy.kind === 'warden' ? 2 : 3) : 0),
      0,
    );
    const armorBlocked = Math.min(damage, player.armor);
    const hpLoss = Math.max(0, damage - player.armor);
    const nextHp = Math.max(0, player.hp - hpLoss);

    setEnemies((current) => current.map((enemy) => moved.find((item) => item.id === enemy.id) || enemy));
    setPlayer((current) => ({ ...current, hp: nextHp, armor: 0 }));
    setTurn((current) => current + 1);
    setEnergy(3);

    addLog(
      damage
        ? `敌人行动：造成 ${damage} 伤害${armorBlocked ? `，护甲抵消 ${armorBlocked}。` : '。'}`
        : '敌人行动：未造成伤害。',
    );

    if (nextHp <= 0) {
      setStatus('lost');
      return;
    }

    const amount = cardsState.hand.length === 0 ? 2 : 1;
    draw(amount);
    if (amount === 2) addLog('手牌耗尽：额外抽 1 张。');
  }

  function restart() {
    window.location.reload();
  }

  const cells = useMemo(
    () => Array.from({ length: W * H }, (_, index) => ({ q: index % W, r: Math.floor(index / W) })),
    [],
  );
  const alive = enemies.filter((enemy) => enemy.hp > 0).length;
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
              const enemy = enemies.find((item) => item.q === c.q && item.r === c.r && item.hp > 0);
              const isPlayer = player.q === c.q && player.r === c.r;
              const fire = hazards.some((hazard) => hazard.q === c.q && hazard.r === c.r);
              const targetingMove = selected && ['move', 'dash'].includes(selected.kind);
              const validMove = targetingMove && dist(player, c) <= (selected.kind === 'dash' ? 4 : 2) && !blocked(c.q, c.r);
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
                      <small>{Math.max(0, enemy.hp)}</small>
                    </span>
                  )}
                  <span className="coord">{String.fromCharCode(65 + c.q)}{c.r + 1}</span>
                </button>
              );
            })}
          </div>
          <div className="legend">◆ 守卫者　 ✦ 掠夺者　 🔥 火焰地形</div>
        </section>

        <aside className="side">
          <div className="panel">
            <div className="panelTitle">当前目标</div>
            <div className="objective">
              {objective}<br />
              <span>{alive} 个单位存活</span>
            </div>
          </div>

          <div className="panel">
            <div className="panelTitle">战斗日志</div>
            <div className="log">{log.map((message, index) => <div key={`${message}-${index}`}>{message}</div>)}</div>
          </div>

          {status === 'playing' ? (
            <button className="end" onClick={endTurn}>结束回合 →</button>
          ) : (
            <button className="end" onClick={restart}>重新开始 ↻</button>
          )}
        </aside>
      </main>

      <section className="handPanel">
        <div className="handTitle">
          <div>
            <span className="eyebrow">DECKBUILDING</span>
            <h2>手牌 <span>{cardsState.hand.length}</span></h2>
          </div>
          <div className="deckMeta">牌库 {cardsState.deck.length} · 弃牌 {cardsState.discard.length}</div>
        </div>
        <div className="hand">
          {cardsState.hand.map((id, index) => {
            const card = cards.find((item) => item.id === id);
            return (
              <button className={`card ${selected?.id === card.id ? 'active' : ''}`} key={`${id}-${index}`} onClick={() => play(card)}>
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
