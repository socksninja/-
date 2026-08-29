'use client';

import { useMemo, useState } from 'react';

const W = 8;
const H = 6;

const baseCards = [
  { id: 'stride', name: '踏步', cost: 1, kind: 'move', text: '移动 2 格。', tag: '移动' },
  { id: 'strike', name: '裂斩', cost: 1, kind: 'attack', text: '相邻敌人受到 5 伤害。', tag: '攻击' },
  { id: 'ember', name: '余烬', cost: 1, kind: 'attack2', text: '远程造成 3 伤害，并在目标脚下留下火焰。', tag: '攻击' },
  { id: 'dash', name: '冲刺', cost: 2, kind: 'dash', text: '移动 4 格；若结束在敌人旁边，造成 2 伤害。', tag: '移动' },
  { id: 'guard', name: '护势', cost: 1, kind: 'guard', text: '获得 5 护甲。', tag: '防御' },
  { id: 'burst', name: '爆燃', cost: 2, kind: 'burst', text: '引爆全部火焰：每个火焰格对相邻敌人造成 4 伤害。', tag: '地形' },
  { id: 'focus', name: '专注', cost: 0, kind: 'draw', text: '抽 2 张牌。', tag: '资源' },
  { id: 'pulse', name: '震荡', cost: 2, kind: 'aoe', text: '对距离 ≤2 的所有敌人造成 3 伤害。', tag: '范围' },
  { id: 'charge', name: '蓄力', cost: 1, kind: 'charge', text: '获得蓄势：下一张攻击牌伤害 +4。', tag: '构筑' },
  { id: 'shove', name: '推击', cost: 1, kind: 'shove', text: '攻击目标并将其推开 1 格。', tag: '空间' },
];

const rewardCards = [
  baseCards.find((card) => card.id === 'charge'),
  baseCards.find((card) => card.id === 'shove'),
  { id: 'trapfire', name: '炼狱陷阱', cost: 1, kind: 'trapfire', text: '在目标空格制造火焰。', tag: '地形' },
].filter(Boolean);

const initialEnemies = [
  { id: 'a', q: 6, r: 1, hp: 10, max: 10, kind: 'marauder', name: '掠夺者' },
  { id: 'b', q: 5, r: 4, hp: 14, max: 14, kind: 'warden', name: '守卫者' },
];

const neighborDirs = [
  { q: 1, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 1 },
  { q: 0, r: -1 }, { q: 1, r: 1 }, { q: -1, r: -1 },
];

function key(q, r) { return `${q},${r}`; }

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

function makeDeck(extraCards = []) {
  return shuffle([...baseCards.slice(0, 8), ...extraCards].flatMap((card) => [card.id, card.id]));
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

function intentFor(enemy, player) {
  const d = dist(enemy, player);
  if (enemy.kind === 'warden' && d <= 2) return { type: '远程打击', damage: 2, range: 2 };
  if (enemy.kind === 'marauder' && d === 1) return { type: '近战攻击', damage: 3, range: 1 };
  if (enemy.kind === 'warden') return { type: '蓄力移动', damage: 2, range: 2 };
  return { type: '逼近并攻击', damage: 3, range: 1 };
}

function stepToward(from, target, occupied) {
  const candidates = neighborDirs
    .map((d) => ({ q: from.q + d.q, r: from.r + d.r }))
    .filter((p) => p.q >= 0 && p.q < W && p.r >= 0 && p.r < H)
    .filter((p) => !occupied.has(key(p.q, p.r)));
  candidates.sort((a, b) => dist(a, target) - dist(b, target));
  return candidates[0] && dist(candidates[0], target) < dist(from, target) ? candidates[0] : from;
}

function nextBattle(extraCards) {
  const deck = makeDeck(extraCards);
  return { deck: deck.slice(0, -5), hand: deck.slice(-5), discard: [] };
}

export default function Home() {
  const [player, setPlayer] = useState({ q: 1, r: 3, hp: 20, max: 20, armor: 0, power: 0 });
  const [enemies, setEnemies] = useState(initialEnemies);
  const [hazards, setHazards] = useState([]);
  const [extraCards, setExtraCards] = useState([]);
  const [cardsState, setCardsState] = useState(() => nextBattle([]));
  const [energy, setEnergy] = useState(3);
  const [turn, setTurn] = useState(1);
  const [selected, setSelected] = useState(null);
  const [log, setLog] = useState(['战斗开始。敌人的行动意图已公开。']);
  const [status, setStatus] = useState('playing');
  const [rewardOptions, setRewardOptions] = useState([]);

  const cardById = (id) => baseCards.find((card) => card.id === id) || extraCards.find((card) => card.id === id);

  function addLog(message) { setLog((current) => [message, ...current].slice(0, 8)); }

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

  function draw(amount) { setCardsState((state) => drawFromState(state, amount)); }

  function checkVictory(nextEnemies, nextHp) {
    if (nextEnemies.length && nextEnemies.every((enemy) => enemy.hp <= 0)) {
      const options = shuffle(rewardCards).slice(0, 3);
      setRewardOptions(options);
      setStatus('reward');
      addLog('战斗胜利。选择一张新卡加入卡组。');
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
    if (['move', 'dash', 'attack', 'attack2', 'shove', 'trapfire'].includes(card.kind)) {
      if (!spend(card)) return;
      setSelected(card);
      addLog(`${card.name}：${['move', 'dash'].includes(card.kind) ? '选择落点。' : card.kind === 'trapfire' ? '选择空白格。' : '选择目标。'}`);
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

    if (card.kind === 'charge') {
      if (!spend(card)) return;
      setPlayer((current) => ({ ...current, power: current.power + 4 }));
      finishCard(card, '蓄势完成：下一张攻击牌额外 +4 伤害。');
      return;
    }

    if (card.kind === 'burst') {
      if (!spend(card)) return;
      const nextEnemies = enemies.map((enemy) => hazards.some((hazard) => dist(hazard, enemy) <= 1) ? { ...enemy, hp: enemy.hp - 4 - player.power } : enemy);
      setPlayer((current) => ({ ...current, power: 0 }));
      setEnemies(nextEnemies);
      setHazards([]);
      finishCard(card, '爆燃：引爆全部火焰。');
      checkVictory(nextEnemies, player.hp);
      return;
    }

    if (card.kind === 'aoe') {
      if (!spend(card)) return;
      const nextEnemies = enemies.map((enemy) => dist(player, enemy) <= 2 ? { ...enemy, hp: enemy.hp - 3 - player.power } : enemy);
      setPlayer((current) => ({ ...current, power: 0 }));
      setEnemies(nextEnemies);
      finishCard(card, '震荡：范围内敌人受到伤害。');
      checkVictory(nextEnemies, player.hp);
    }
  }

  function blocked(q, r) {
    return enemies.some((enemy) => enemy.q === q && enemy.r === r && enemy.hp > 0) || (player.q === q && player.r === r);
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
        ? enemies.map((enemy) => enemy.hp > 0 && dist(enemy, { q, r }) === 1 ? { ...enemy, hp: enemy.hp - 2 - player.power } : enemy)
        : enemies;
      setPlayer((current) => ({ ...current, q, r, power: 0 }));
      setEnemies(nextEnemies);
      finishCard(card, `移动到 (${q + 1},${r + 1})。`);
      checkVictory(nextEnemies, player.hp);
      return;
    }

    if (card.kind === 'trapfire') {
      if (enemies.some((enemy) => enemy.q === q && enemy.r === r && enemy.hp > 0) || (player.q === q && player.r === r)) {
        addLog('这里不能放置火焰。');
        return;
      }
      setHazards((current) => [...current.filter((h) => !(h.q === q && h.r === r)), { q, r }]);
      finishCard(card, `火焰陷阱布置在 (${q + 1},${r + 1})。`);
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

    const amount = (card.kind === 'attack' ? 5 : card.kind === 'attack2' ? 3 : 3) + player.power;
    let nextTarget = target;
    if (card.kind === 'shove') {
      const occupied = new Set([key(player.q, player.r), ...enemies.filter((e) => e.hp > 0 && e.id !== target.id).map((e) => key(e.q, e.r))]);
      const pushed = stepToward(target, { q: target.q + (target.q - player.q), r: target.r + (target.r - player.r) }, occupied);
      nextTarget = { ...target, ...pushed, hp: target.hp - amount };
    } else {
      nextTarget = { ...target, hp: target.hp - amount };
    }
    const nextEnemies = enemies.map((enemy) => enemy.id === target.id ? nextTarget : enemy);
    setEnemies(nextEnemies);
    setPlayer((current) => ({ ...current, power: 0 }));
    if (card.kind === 'attack2') {
      setHazards((current) => [...current.filter((h) => !(h.q === target.q && h.r === target.r)), { q: target.q, r: target.r }]);
    }
    finishCard(card, `${target.name} 受到 ${amount} 伤害。`);
    checkVictory(nextEnemies, player.hp);
  }

  function endTurn() {
    if (status !== 'playing') return;
    setSelected(null);
    let nextEnemies = enemies.map((enemy) => ({ ...enemy }));
    const occupiedStart = new Set([key(player.q, player.r)]);

    nextEnemies = nextEnemies.map((enemy, index) => {
      if (enemy.hp <= 0) return enemy;
      const intent = intentFor(enemy, player);
      if (intent.type.includes('攻击')) return enemy;
      const occupied = new Set([
        ...occupiedStart,
        ...nextEnemies.filter((other, i) => i !== index && other.hp > 0).map((other) => key(other.q, other.r)),
      ]);
      const next = stepToward(enemy, player, occupied);
      return { ...enemy, ...next };
    });

    let damage = 0;
    nextEnemies.forEach((enemy) => {
      const intent = intentFor(enemy, player);
      const distance = dist(enemy, player);
      if (intent.range === 1 && distance === 1) damage += intent.damage;
      if (intent.range === 2 && distance <= 2) damage += intent.damage;
    });

    const fireDamage = hazards.some((hazard) => hazard.q === player.q && hazard.r === player.r) ? 2 : 0;
    const totalDamage = damage + fireDamage;
    const blockedDamage = Math.min(totalDamage, player.armor);
    const hpLoss = Math.max(0, totalDamage - player.armor);
    const nextHp = Math.max(0, player.hp - hpLoss);

    setEnemies(nextEnemies);
    setPlayer((current) => ({ ...current, hp: nextHp, armor: 0 }));
    setTurn((current) => current + 1);
    setEnergy(3);
    addLog(totalDamage ? `敌人行动：造成 ${totalDamage} 伤害${blockedDamage ? `，护甲抵消 ${blockedDamage}。` : '。'}` : '敌人行动：未造成伤害。');

    if (nextHp <= 0) {
      setStatus('lost');
      return;
    }

    const amount = cardsState.hand.length === 0 ? 2 : 1;
    draw(amount);
    if (amount === 2) addLog('手牌耗尽：额外抽 1 张。');
  }

  function chooseReward(card) {
    const nextExtras = [...extraCards, card];
    setExtraCards(nextExtras);
    setCardsState(nextBattle(nextExtras));
    setEnemies(initialEnemies.map((enemy) => ({ ...enemy })));
    setHazards([]);
    setPlayer({ q: 1, r: 3, hp: 20, max: 20, armor: 0, power: 0 });
    setEnergy(3);
    setTurn((current) => current + 1);
    setSelected(null);
    setRewardOptions([]);
    setStatus('playing');
    setLog([`加入新卡：${card.name}。进入下一场战斗。`, '第二场战斗开始。']);
  }

  function restart() {
    setExtraCards([]);
    setCardsState(nextBattle([]));
    setEnemies(initialEnemies.map((enemy) => ({ ...enemy })));
    setHazards([]);
    setPlayer({ q: 1, r: 3, hp: 20, max: 20, armor: 0, power: 0 });
    setEnergy(3);
    setTurn(1);
    setSelected(null);
    setRewardOptions([]);
    setStatus('playing');
    setLog(['战斗重新开始。敌人的行动意图已公开。']);
  }

  const cells = useMemo(() => Array.from({ length: W * H }, (_, index) => ({ q: index % W, r: Math.floor(index / W) })), []);
  const alive = enemies.filter((enemy) => enemy.hp > 0).length;
  const objective = status === 'reward' ? '选择战利品' : status === 'lost' ? '战斗失败' : `击败全部敌人 · ${alive} 名存活`;

  return (
    <div className="app">
      <header>
        <div>
          <div className="eyebrow">PROJECT FORGE #001 · V0.2</div>
          <h1>HEXBOUND <span>战场构筑原型</span></h1>
          <p>敌人意图 × 六边形战场 × Deckbuilding</p>
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
              const validTarget = selected && ['attack', 'attack2', 'shove'].includes(selected.kind) && enemy;
              const validFire = selected?.kind === 'trapfire' && !enemy && !isPlayer;
              const intent = enemy ? intentFor(enemy, player) : null;

              return (
                <button
                  key={key(c.q, c.r)}
                  className={`hex row-${c.r % 2} ${fire ? 'fire ' : ''}${validMove ? 'movable ' : ''}${validTarget ? 'targetable ' : ''}${validFire ? 'fireTarget ' : ''}`}
                  onClick={() => cell(c.q, c.r)}
                >
                  <span className="coord">{c.q + 1},{c.r + 1}</span>
                  {fire && <span className="hazardMark">✦</span>}
                  {isPlayer && <div className="unit hero"><span>◆</span><small>你</small></div>}
                  {enemy && <div className={`unit ${enemy.kind}`}><span>{enemy.kind === 'marauder' ? '⚔' : '◈'}</span><small>{enemy.name} · {Math.max(0, enemy.hp)}/{enemy.max}</small><em>{intent?.type}</em></div>}
                </button>
              );
            })}
          </div>
          <div className="legend">绿色 = 可移动 · 橙色 = 火焰 · 敌人头顶显示下一行动意图</div>
        </section>

        <aside className="side">
          <div className="panel">
            <div className="panelTitle">OBJECTIVE</div>
            <div className="objective">{objective}</div>
            <div className="deckMeta">卡组新增 {extraCards.length} 张</div>
          </div>
          <div className="panel">
            <div className="panelTitle">COMBAT LOG</div>
            <div className="log">{log.map((entry, index) => <div key={`${entry}-${index}`}>{entry}</div>)}</div>
          </div>
          <button className="end" onClick={endTurn} disabled={status !== 'playing'}>结束回合 →</button>
        </aside>
      </main>

      <section className="handPanel">
        <div className="handTitle">
          <div>
            <div className="panelTitle">HAND</div>
            <h2>你的手牌 <span>{cardsState.hand.length} 张</span></h2>
          </div>
          <div className="deckMeta">牌堆 {cardsState.deck.length} · 弃牌 {cardsState.discard.length}</div>
        </div>
        <div className="hand">
          {cardsState.hand.map((id, index) => {
            const card = cardById(id);
            if (!card) return null;
            return <button key={`${id}-${index}`} className={`card ${selected?.id === id ? 'active' : ''}`} onClick={() => play(card)} disabled={status !== 'playing'}>
              <div className="cardTop"><span className="tag">{card.tag}</span><b>{card.cost}</b></div>
              <h3>{card.name}</h3>
              <p>{card.text}</p>
            </button>;
          })}
        </div>
      </section>

      {status === 'reward' && (
        <div className="modalLayer">
          <div className="rewardModal">
            <div className="panelTitle">BATTLE REWARD</div>
            <h2>选一张牌加入你的构筑</h2>
            <p>你的选择会进入下一场战斗。</p>
            <div className="rewardGrid">
              {rewardOptions.map((card) => <button key={card.id} className="rewardCard" onClick={() => chooseReward(card)}>
                <div className="cardTop"><span className="tag">{card.tag}</span><b>{card.cost}</b></div>
                <h3>{card.name}</h3>
                <p>{card.text}</p>
              </button>)}
            </div>
          </div>
        </div>
      )}

      {status === 'lost' && (
        <div className="modalLayer">
          <div className="rewardModal">
            <div className="panelTitle">RUN ENDED</div>
            <h2>你倒下了</h2>
            <p>再打一局，看看能不能把构筑做得更顺。</p>
            <button className="end" onClick={restart}>重新开始</button>
          </div>
        </div>
      )}
    </div>
  );
}
