(() => {
  const canvas = document.getElementById("mcgecko-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("mcgecko-score");
  const livesEl = document.getElementById("mcgecko-lives");
  const levelEl = document.getElementById("mcgecko-level");
  const powerEl = document.getElementById("mcgecko-power");
  const statusEl = document.getElementById("mcgecko-status");
  const startBtn = document.getElementById("mcgecko-start");
  const pauseBtn = document.getElementById("mcgecko-pause");

  const TILE = 28;
  const MAP = [
    "####################",
    "#........##........#",
    "#.####.#.##.#.####.#",
    "#C####.#.##.#.####C#",
    "#..................#",
    "#.####.###..###.##.#",
    "#......#....#......#",
    "######.#.####.#.####",
    "#........M.........#",
    "#.####.#....#.####.#",
    "#......#....#......#",
    "######.#.####.#.####",
    "#..................#",
    "#.####.#.##.#.####.#",
    "#C....#....#....C..#",
    "###.#.####.####.#.##",
    "#...#......#......##",
    "#.######.####.####.#",
    "#..................#",
    "####################"
  ];
  const ROWS = MAP.length, COLS = MAP[0].length;
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;

  let state = null;
  let raf = 0;
  let last = 0;

  const dirs = {
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1]
  };

  function resetGame() {
    const pellets = [];
    const cds = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (MAP[r][c] === ".") pellets.push({r, c});
        if (MAP[r][c] === "C") cds.push({r, c});
      }
    }
    state = {
      running: true, paused: false, score: 0, lives: 3, level: 1,
      player: {r: 14, c: 1, dir: [0, 0], next: [0, 0]},
      enemies: [
        {r: 8, c: 9, dir: [1, 0], kind: "worm"},
        {r: 8, c: 10, dir: [-1, 0], kind: "bug"},
        {r: 8, c: 11, dir: [0, 1], kind: "trojan"},
        {r: 16, c: 10, dir: [1, 0], kind: "spyware"}
      ],
      pellets, cds, powerUntil: 0, elapsed: 0, flash: 0
    };
    updateHud();
    statusEl.textContent = "Go! Collect every anti-virus CD and avoid the malware.";
    pauseBtn.textContent = "⏸ Pause";
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function isWall(r, c) {
    return r < 0 || r >= ROWS || c < 0 || c >= COLS || MAP[r][c] === "#";
  }

  function canMove(r, c, d) {
    return !isWall(r + d[1], c + d[0]);
  }

  function same(a, b) { return a.r === b.r && a.c === b.c; }

  function setDirection(d) {
    if (!state || !state.running) return;
    state.player.next = d;
    if (canMove(state.player.r, state.player.c, d)) state.player.dir = d;
  }

  function moveEntity(entity, speedBias = 1) {
    if (Math.random() > speedBias) return;
    const d = entity.dir;
    if (!canMove(entity.r, entity.c, d)) return;
    entity.c += d[0];
    entity.r += d[1];
  }

  function chooseEnemyDirection(enemy) {
    const options = [[1,0],[-1,0],[0,1],[0,-1]].filter(d => canMove(enemy.r, enemy.c, d));
    if (!options.length) return;
    const reverse = [-enemy.dir[0], -enemy.dir[1]];
    const forward = options.filter(d => d[0] !== reverse[0] || d[1] !== reverse[1]);
    const pool = forward.length ? forward : options;
    if (enemy.kind === "worm") {
      pool.sort((a,b) => {
        const da = Math.abs(enemy.r + a[1] - state.player.r) + Math.abs(enemy.c + a[0] - state.player.c);
        const db = Math.abs(enemy.r + b[1] - state.player.r) + Math.abs(enemy.c + b[0] - state.player.c);
        return da - db;
      });
      enemy.dir = pool[0];
    } else {
      enemy.dir = pool[Math.floor(Math.random() * pool.length)];
    }
  }

  function tick() {
    if (!state.running || state.paused) return;
    state.elapsed += 1;
    const p = state.player;
    if (canMove(p.r, p.c, p.next)) p.dir = p.next;
    moveEntity(p, 1);

    state.pellets = state.pellets.filter(dot => {
      if (same(dot, p)) { state.score += 10; return false; }
      return true;
    });
    state.cds = state.cds.filter(cd => {
      if (same(cd, p)) {
        state.score += 50;
        state.powerUntil = performance.now() + 6500;
        statusEl.textContent = "🛡️ Antivirus shield active! Malware can be tagged.";
        return false;
      }
      return true;
    });

    for (const e of state.enemies) {
      if (!canMove(e.r, e.c, e.dir)) chooseEnemyDirection(e);
      moveEntity(e, e.kind === "worm" ? 0.9 : 0.72);
      if (!canMove(e.r, e.c, e.dir) || Math.random() < 0.12) chooseEnemyDirection(e);
    }

    const powered = performance.now() < state.powerUntil;
    for (const e of state.enemies) {
      if (same(e, p)) {
        if (powered) {
          state.score += 200;
          e.r = 8; e.c = 10;
          chooseEnemyDirection(e);
          statusEl.textContent = "💥 Malware quarantined! +200";
        } else {
          state.lives--;
          state.flash = 8;
          p.r = 14; p.c = 1; p.dir = [0,0]; p.next = [0,0];
          if (state.lives <= 0) {
            state.running = false;
            statusEl.textContent = "Game over — press Start / Restart to try again.";
          } else {
            statusEl.textContent = "⚠️ Malware got you. One life lost!";
          }
          break;
        }
      }
    }

    if (!state.pellets.length && !state.cds.length && state.running) {
      state.level++;
      state.score += 500;
      state.pellets = [];
      for (let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(MAP[r][c]===".") state.pellets.push({r,c});
      state.cds = [{r:3,c:1},{r:3,c:18},{r:14,c:1},{r:14,c:13}];
      statusEl.textContent = "🎉 Gateway cleared! Level " + state.level + "!";
    }
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = state?.score ?? 0;
    livesEl.textContent = state?.lives ?? 3;
    levelEl.textContent = state?.level ?? 1;
    const remaining = state ? Math.max(0, state.powerUntil - performance.now()) : 0;
    powerEl.textContent = remaining ? (remaining / 1000).toFixed(1) + "s" : "—";
  }

  function draw() {
    ctx.fillStyle = "#06100a";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    const pulse = 0.55 + Math.sin(performance.now()/260) * 0.2;

    for (let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
      if (MAP[r][c] === "#") {
        ctx.fillStyle = "#103b2a";
        ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
        ctx.strokeStyle = "#1b7f4b";
        ctx.strokeRect(c*TILE+1,r*TILE+1,TILE-2,TILE-2);
      }
    }

    ctx.fillStyle = "#f6f3d0";
    for (const d of state?.pellets || []) {
      ctx.beginPath(); ctx.arc(d.c*TILE+14,d.r*TILE+14,2.4,0,Math.PI*2); ctx.fill();
    }

    for (const cd of state?.cds || []) {
      const x=cd.c*TILE+14,y=cd.r*TILE+14;
      ctx.save(); ctx.translate(x,y); ctx.rotate(performance.now()/700);
      ctx.fillStyle="#d9f4ff"; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#0e7490"; ctx.lineWidth=3; ctx.stroke();
      ctx.fillStyle="#0e7490"; ctx.beginPath(); ctx.arc(0,0,2.5,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    if (!state) {
      ctx.fillStyle="#8de0b1"; ctx.font="bold 26px system-ui"; ctx.textAlign="center";
      ctx.fillText("🦎 mcGecko", canvas.width/2, canvas.height/2-10);
      ctx.font="16px system-ui"; ctx.fillText("Press Start to enter the Gateway", canvas.width/2, canvas.height/2+22);
      return;
    }

    drawGecko(state.player, performance.now());
    for (const e of state.enemies) drawMalware(e, pulse);

    if (state.flash) {
      ctx.fillStyle="rgba(255,255,255,.32)"; ctx.fillRect(0,0,canvas.width,canvas.height);
      state.flash--;
    }
  }

  function drawGecko(p, t) {
    const x=p.c*TILE+14,y=p.r*TILE+14;
    const bob=Math.sin(t/100)*1.2;
    ctx.save(); ctx.translate(x,y+bob);
    ctx.fillStyle = performance.now()<state.powerUntil ? "#d9f4ff" : "#5ee37d";
    ctx.beginPath(); ctx.ellipse(0,2,10,7,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(7,-4,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#06100a"; ctx.beginPath(); ctx.arc(9,-6,1.4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#5ee37d"; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(-8,4); ctx.lineTo(-13,8); ctx.moveTo(-3,7); ctx.lineTo(-7,11); ctx.stroke();
    ctx.restore();
  }

  function drawMalware(e, pulse) {
    const x=e.c*TILE+14,y=e.r*TILE+14;
    const shapes={worm:"#ef4444",bug:"#a855f7",trojan:"#f97316",spyware:"#06b6d4"};
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle=shapes[e.kind] || "#ef4444";
    ctx.beginPath(); ctx.arc(0,0,9+pulse,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff";
    ctx.beginPath(); ctx.arc(-3,-2,2,0,Math.PI*2); ctx.arc(3,-2,2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#111";
    ctx.beginPath(); ctx.arc(-3,-2,1,0,Math.PI*2); ctx.arc(3,-2,1,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function loop(t) {
    if (!state) return;
    if (t-last > 115) { tick(); last=t; }
    draw(); updateHud();
    if (state.running) raf=requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", e => {
    if (!dirs[e.key]) return;
    const tag=document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    e.preventDefault();
    setDirection(dirs[e.key]);
  });

  startBtn.addEventListener("click", resetGame);
  pauseBtn.addEventListener("click", () => {
    if (!state || !state.running) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? "▶ Resume" : "⏸ Pause";
    statusEl.textContent = state.paused ? "Paused." : "Back in the Gateway!";
    if (!state.paused) { last=performance.now(); raf=requestAnimationFrame(loop); }
  });

  draw();
})();