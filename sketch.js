// --- 定数定義 ---
// (変更なし)
const GRID_DIVISIONS = 10;
const CELL_SIZE = 35;
const DOT_RADIUS = CELL_SIZE * 0.42;
const STONE_COLOR = [35, 35, 35, 255];

const CANVAS_WIDTH = GRID_DIVISIONS * CELL_SIZE + CELL_SIZE;
const CANVAS_HEIGHT = GRID_DIVISIONS * CELL_SIZE + CELL_SIZE; // ボタンエリア分を考慮して少し広げることも可能
const DRAW_OFFSET = CELL_SIZE / 2;

// 確認ボタン用の定数
const CONFIRM_BUTTON_HEIGHT = CELL_SIZE * 1.2;
const CONFIRM_BUTTON_WIDTH = CELL_SIZE * 3;
const CONFIRM_BUTTON_PADDING = 10; // ボタン間の余白

// --- グローバル変数 ---
// (既存の変数)
let placedStones = [];
let currentPlayer = 1;
let playerNames = { 1: "プレイヤー1", 2: "プレイヤー2" };
let gameOver = false;
let highlightedStones = [];
let conicPath = null;
let resetButton;
let inputPlayer1Name, inputPlayer2Name;
let canvasInstance;

// ★ 新しいグローバル変数
let gameState = 'placing'; // 'placing' (配置選択中), 'confirming' (配置確認中)
let previewStone = null;   // {x: gridX, y: gridY} 仮置きする石の格子座標
let okButton, cancelButton; // 確認ボタンの当たり判定用オブジェクト

// ------------------------------------
// p5.js のライフサイクル関数
// ------------------------------------
function setup() {
    // キャンバスの高さをボタン分だけ少し広げる場合
    // createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT + CONFIRM_BUTTON_HEIGHT + CONFIRM_BUTTON_PADDING * 2);
    // 今回は、ボタンはグリッドエリアの外、下部に描画することを目指し、
    // キャンバスサイズは一旦そのままにして、ボタンがグリッドと重ならないようにY座標を調整します。
    // もしボタンをグリッドの下に完全に分離したいなら、CANVAS_HEIGHTを増やす必要があります。
    canvasInstance = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    let controlsDiv = select('.controls');
    if (controlsDiv) {
        canvasInstance.parent(controlsDiv.elt.parentNode, controlsDiv.elt.nextSibling);
    }

    textFont('Inter, Noto Sans JP, sans-serif');
    resetButton = select('#resetButton');
    resetButton.mousePressed(resetGame);
    inputPlayer1Name = select('#player1NameInput');
    inputPlayer2Name = select('#player2NameInput');
    inputPlayer1Name.input(updatePlayerNames);
    inputPlayer2Name.input(updatePlayerNames);

    // 確認ボタンの定義 (位置はdraw内で動的に決めることも、固定にすることも可能)
    // 今回は盤面の下部中央に固定で表示
    const buttonY = GRID_DIVISIONS * CELL_SIZE + DRAW_OFFSET + CONFIRM_BUTTON_PADDING + CONFIRM_BUTTON_HEIGHT / 2;
    // ただし、このY座標はtranslate後の座標系。実際の描画は translate(-DRAW_OFFSET, -DRAW_OFFSET) 後に。
    // もっと簡単なのは、キャンバスの下端を基準にする。
    // 画面下部にボタンを配置
    const totalButtonWidth = CONFIRM_BUTTON_WIDTH * 2 + CONFIRM_BUTTON_PADDING;
    const buttonStartX = (width - totalButtonWidth) / 2; // キャンバス全体の幅基準

    okButton = {
        x: buttonStartX,
        y: height - CONFIRM_BUTTON_HEIGHT - CONFIRM_BUTTON_PADDING, // キャンバス下端基準
        w: CONFIRM_BUTTON_WIDTH,
        h: CONFIRM_BUTTON_HEIGHT,
        label: "置く"
    };
    cancelButton = {
        x: buttonStartX + CONFIRM_BUTTON_WIDTH + CONFIRM_BUTTON_PADDING,
        y: height - CONFIRM_BUTTON_HEIGHT - CONFIRM_BUTTON_PADDING, // キャンバス下端基準
        w: CONFIRM_BUTTON_WIDTH,
        h: CONFIRM_BUTTON_HEIGHT,
        label: "やめる"
    };


    textAlign(CENTER, CENTER);
    updatePlayerNames();
    resetGame();
}

function draw() {
    background(238, 241, 245);
    
    push(); // グリッドと石のための描画コンテキスト
    translate(DRAW_OFFSET, DRAW_OFFSET);
    drawGrid();
    if (gameOver && conicPath) {
        drawConicPath();
    }
    drawStones();
    if (gameState === 'confirming' && previewStone) {
        drawPreviewStone();
    }
    pop(); // グリッドと石の描画コンテキストを終了

    // 確認ボタンは translate の影響を受けないキャンバス座標で描画
    if (gameState === 'confirming') {
        drawConfirmButtons();
    }
    
    updateMessageDisplay();
}

function mousePressed() {
    if (gameOver) return;

    if (gameState === 'placing') {
        // 石の配置選択
        // マウス座標がキャンバス内かチェック (translate前の座標で)
        if (mouseX < DRAW_OFFSET || mouseX > CANVAS_WIDTH - DRAW_OFFSET || 
            mouseY < DRAW_OFFSET || mouseY > CANVAS_HEIGHT - DRAW_OFFSET) {
            // グリッドエリア外のクリックは何もしない (ボタンエリアは除く)
            // ただし、確認ボタンがないときは何もしない
            return;
        }

        let boardMouseX = mouseX - DRAW_OFFSET;
        let boardMouseY = mouseY - DRAW_OFFSET;
        let gridX = Math.round(boardMouseX / CELL_SIZE);
        let gridY = Math.round(boardMouseY / CELL_SIZE);

        if (gridX >= 0 && gridX <= GRID_DIVISIONS &&
            gridY >= 0 && gridY <= GRID_DIVISIONS) {
            if (!isStoneAt(gridX, gridY)) {
                previewStone = { x: gridX, y: gridY };
                gameState = 'confirming';
            }
        }
    } else if (gameState === 'confirming') {
        // 確認ボタンのクリック判定 (translate前の座標で)
        if (isButtonClicked(okButton, mouseX, mouseY)) {
            placeStoneAtPreviewLocation(); // 石を正式に配置
            gameState = 'placing';
            previewStone = null;
        } else if (isButtonClicked(cancelButton, mouseX, mouseY)) {
            gameState = 'placing';
            previewStone = null;
        } else {
            // ボタン以外の場所をクリックした場合、新しい仮置き場所を選択する
            // ただし、クリックがグリッドエリア内なら
            if (mouseX >= DRAW_OFFSET && mouseX <= CANVAS_WIDTH - DRAW_OFFSET && 
                mouseY >= DRAW_OFFSET && mouseY <= CANVAS_HEIGHT - DRAW_OFFSET) {
                
                let boardMouseX = mouseX - DRAW_OFFSET;
                let boardMouseY = mouseY - DRAW_OFFSET;
                let gridX = Math.round(boardMouseX / CELL_SIZE);
                let gridY = Math.round(boardMouseY / CELL_SIZE);

                if (gridX >= 0 && gridX <= GRID_DIVISIONS &&
                    gridY >= 0 && gridY <= GRID_DIVISIONS) {
                    if (!isStoneAt(gridX, gridY)) {
                        previewStone = { x: gridX, y: gridY }; // 新しいプレビュー場所
                    } else if (gridX === previewStone.x && gridY === previewStone.y) {
                        // プレビュー中の石を再度クリックしたら確定、という動作も考えられる
                        // placeStoneAtPreviewLocation();
                        // gameState = 'placing';
                        // previewStone = null;
                    }
                }
            } else {
                 // グリッドエリア外かつボタン外なら何もしない (キャンセルもしない)
                 // または、ここでキャンセル扱いにする場合は gameState = 'placing'; previewStone = null;
            }
        }
    }
}

// ------------------------------------
// 石の配置と確認関連の関数
// ------------------------------------
function placeStoneAtPreviewLocation() {
    if (!previewStone) return;

    const newStone = { x: previewStone.x, y: previewStone.y };
    placedStones.push(newStone);

    if (placedStones.length >= 4) {
        const combinations = getCombinations(placedStones, 4);
        for (const combo of combinations) {
            if (arePointsConcyclicOrCollinear(combo[0], combo[1], combo[2], combo[3])) {
                gameOver = true;
                highlightedStones = [...combo];
                prepareConicPathToDraw();
                break;
            }
        }
    }

    if (!gameOver) {
        if (placedStones.length === (GRID_DIVISIONS + 1) * (GRID_DIVISIONS + 1)) {
            gameOver = true; // 引き分け
        } else {
            currentPlayer = (currentPlayer === 1) ? 2 : 1;
        }
    }
}

function drawPreviewStone() {
    if (!previewStone) return;
    // 石本体と同じ色だが、アルファ値を下げて半透明にする
    let previewColor = color(STONE_COLOR[0], STONE_COLOR[1], STONE_COLOR[2], 128); // 半透明
    fill(previewColor);
    noStroke();
    ellipse(
        previewStone.x * CELL_SIZE,
        previewStone.y * CELL_SIZE,
        DOT_RADIUS * 2,
        DOT_RADIUS * 2
    );
}

function drawConfirmButtons() {
    // OKボタン
    fill(92, 184, 92, 220); // 緑系
    noStroke();
    rect(okButton.x, okButton.y, okButton.w, okButton.h, 5); // 角丸
    fill(255);
    textSize(CONFIRM_BUTTON_HEIGHT * 0.4);
    text(okButton.label, okButton.x + okButton.w / 2, okButton.y + okButton.h / 2);

    // Cancelボタン
    fill(217, 83, 79, 220); // 赤系
    noStroke();
    rect(cancelButton.x, cancelButton.y, cancelButton.w, cancelButton.h, 5); // 角丸
    fill(255);
    textSize(CONFIRM_BUTTON_HEIGHT * 0.4);
    text(cancelButton.label, cancelButton.x + cancelButton.w / 2, cancelButton.y + cancelButton.h / 2);
}

function isButtonClicked(button, mx, my) {
    return mx >= button.x && mx <= button.x + button.w &&
           my >= button.y && my <= button.y + button.h;
}

// ------------------------------------
// 描画関連関数 (既存)
// ------------------------------------
function drawGrid() { /* ... (変更なし) ... */ 
    stroke(190, 195, 205);
    strokeWeight(1);
    for (let i = 0; i <= GRID_DIVISIONS; i++) {
        line(i * CELL_SIZE, 0, i * CELL_SIZE, GRID_DIVISIONS * CELL_SIZE);
        line(0, i * CELL_SIZE, GRID_DIVISIONS * CELL_SIZE, i * CELL_SIZE);
    }
    if (GRID_DIVISIONS === 12) {
      let starPoints = [ {x:3, y:3}, {x:3, y:9}, {x:9, y:3}, {x:9, y:9}, {x:6, y:6} ];
      fill(170, 175, 185);
      noStroke();
      for (const p of starPoints) {
          ellipse(p.x * CELL_SIZE, p.y * CELL_SIZE, DOT_RADIUS * 0.2, DOT_RADIUS * 0.2);
      }
    }
}
function drawStones() { /* ... (変更なし、ハイライト含む) ... */ 
    for (const stone of placedStones) {
        fill(0, 0, 0, 30);
        noStroke();
        ellipse(stone.x * CELL_SIZE + 1.5, stone.y * CELL_SIZE + 1.5, DOT_RADIUS * 2, DOT_RADIUS * 2);
        fill(STONE_COLOR[0], STONE_COLOR[1], STONE_COLOR[2], STONE_COLOR[3]);
        fill(255, 255, 255, 50);
        ellipse(stone.x * CELL_SIZE - DOT_RADIUS * 0.35, stone.y * CELL_SIZE - DOT_RADIUS * 0.35, DOT_RADIUS, DOT_RADIUS);
        fill(STONE_COLOR[0], STONE_COLOR[1], STONE_COLOR[2], STONE_COLOR[3]);
        if (gameOver && highlightedStones.some(hs => hs.x === stone.x && hs.y === stone.y)) {
            stroke(255, 200, 0); 
            strokeWeight(3);
        } else {
            noStroke();
        }
        ellipse(stone.x * CELL_SIZE, stone.y * CELL_SIZE, DOT_RADIUS * 2, DOT_RADIUS * 2);
    }
    noStroke();
}

function updateMessageDisplay() {
    let gameOverTitleHtml = "";
    let turnOrWinnerHtml = "";

    if (gameState === 'confirming' && previewStone && !gameOver) {
        const targetPlayerName = playerNames[currentPlayer];
        const targetPlayerColor = currentPlayer === 1 ? '#d9534f' : '#428bca';
        turnOrWinnerHtml = `石を置く場所: (${previewStone.x}, ${previewStone.y})<br><strong style="color:${targetPlayerColor}; font-weight:700;">${targetPlayerName}</strong> さん、ここに置きますか？`;
    } else if (gameOver) {
        const loserName = playerNames[currentPlayer]; // ゲームオーバーを引き起こした手番のプレイヤー
        const winnerNum = (currentPlayer === 1) ? 2 : 1;
        const winnerName = playerNames[winnerNum];

        if (highlightedStones.length > 0) {
             gameOverTitleHtml = `<strong style="font-size:1.5em; color: #e74c3c; display:block; margin-bottom:5px;">共円成立！</strong>`;
             turnOrWinnerHtml = `<span style="font-size:1.1em;">${loserName} が配置。<br><strong style="color: #27ae60;">${winnerName} の勝利！</strong></span>`;
        } else { // 引き分け
            gameOverTitleHtml = `<strong style="font-size: 1.5em; display:block; margin-bottom:5px;">引き分け！</strong>`;
            turnOrWinnerHtml = `<span style="font-size:1.1em;">全てのマスが埋まりました。</span>`;
        }
    } else { // 通常の配置選択中
        const currentPlayerColor = currentPlayer === 1 ? '#d9534f' : '#428bca';
        turnOrWinnerHtml = `次は <strong style="color:${currentPlayerColor}; font-weight:700;">${playerNames[currentPlayer]}</strong> の手番です`;
    }
    select('#messageArea').html(gameOverTitleHtml + turnOrWinnerHtml);
}


// ------------------------------------
// 共円/直線 表示準備と描画 (既存)
// ------------------------------------
function prepareConicPathToDraw() { /* ... (変更なし) ... */ 
    if (highlightedStones.length < 4) {
        conicPath = null; return;
    }
    const [p1, p2, p3, p4] = highlightedStones;
    if (areThreePointsCollinear(p1, p2, p3) && areThreePointsCollinear(p1, p2, p4) && areThreePointsCollinear(p1,p3,p4) && areThreePointsCollinear(p2,p3,p4) ) {
        let sortedStones = [...highlightedStones].sort((a, b) => (a.x !== b.x) ? a.x - b.x : a.y - b.y);
        conicPath = { type: 'line', data: { p_start: sortedStones[0], p_end: sortedStones[3] } };
    } else { 
        let circleData = null;
        const combos3 = getCombinations(highlightedStones, 3);
        for (const combo of combos3) {
            const [c1, c2, c3] = combo;
            if (!areThreePointsCollinear(c1, c2, c3)) {
                circleData = calculateCircleFrom3Points(c1, c2, c3);
                if (circleData) {
                    const fourthPoint = highlightedStones.find(p => 
                        (p.x !== c1.x || p.y !== c1.y) && 
                        (p.x !== c2.x || p.y !== c2.y) && 
                        (p.x !== c3.x || p.y !== c3.y)
                    );
                    if (fourthPoint) {
                        const d = dist(fourthPoint.x, fourthPoint.y, circleData.center.x, circleData.center.y);
                        const tolerance = Math.max(0.01, circleData.radius * 0.02); // 許容誤差を調整
                        if (Math.abs(d - circleData.radius) < tolerance) {
                            break; 
                        }
                    }
                    circleData = null; 
                }
            }
        }
        if (circleData) {
            conicPath = { type: 'circle', data: circleData };
        } else {
            console.warn("最終的に円も直線も特定できませんでした。highlightedStones:", highlightedStones);
            let sortedStones = [...highlightedStones].sort((a,b) => (a.x - b.x) || (a.y - b.y));
            conicPath = { type: 'line', data: {p_start: sortedStones[0], p_end: sortedStones[3] } };
        }
    }
}
function drawConicPath() { /* ... (変更なし、突き抜け処理含む) ... */ 
    if (!conicPath || !conicPath.data) return;
    push();
    strokeWeight(3.5); 
    noFill();
    let pathColor = color(255, 69, 0, 220); 
    if (conicPath.type === 'circle' && conicPath.data.center && conicPath.data.radius > 0) {
        stroke(pathColor);
        ellipseMode(CENTER);
        ellipse(
            conicPath.data.center.x * CELL_SIZE,
            conicPath.data.center.y * CELL_SIZE,
            conicPath.data.radius * 2 * CELL_SIZE,
            conicPath.data.radius * 2 * CELL_SIZE
        );
    } else if (conicPath.type === 'line' && conicPath.data.p_start && conicPath.data.p_end) {
        stroke(pathColor);
        let p1_px = { x: conicPath.data.p_start.x * CELL_SIZE, y: conicPath.data.p_start.y * CELL_SIZE };
        let p2_px = { x: conicPath.data.p_end.x * CELL_SIZE, y: conicPath.data.p_end.y * CELL_SIZE };
        const minX = 0; const maxX = GRID_DIVISIONS * CELL_SIZE;
        const minY = 0; const maxY = GRID_DIVISIONS * CELL_SIZE;
        let pointsOnBorder = [];
        if (Math.abs(p1_px.x - p2_px.x) < 1e-6) { 
            pointsOnBorder.push({ x: p1_px.x, y: minY }); pointsOnBorder.push({ x: p1_px.x, y: maxY });
        } else if (Math.abs(p1_px.y - p2_px.y) < 1e-6) {
            pointsOnBorder.push({ x: minX, y: p1_px.y }); pointsOnBorder.push({ x: maxX, y: p1_px.y });
        } else {
            const slope = (p2_px.y - p1_px.y) / (p2_px.x - p1_px.x);
            const yIntercept = p1_px.y - slope * p1_px.x;
            let yAtMinX = slope * minX + yIntercept; if (yAtMinX >= minY && yAtMinX <= maxY) pointsOnBorder.push({ x: minX, y: yAtMinX });
            let yAtMaxX = slope * maxX + yIntercept; if (yAtMaxX >= minY && yAtMaxX <= maxY) pointsOnBorder.push({ x: maxX, y: yAtMaxX });
            if (Math.abs(slope) > 1e-6) {
                let xAtMinY = (minY - yIntercept) / slope; if (xAtMinY >= minX && xAtMinY <= maxX) pointsOnBorder.push({ x: xAtMinY, y: minY });
                let xAtMaxY = (maxY - yIntercept) / slope; if (xAtMaxY >= minX && xAtMaxY <= maxX) pointsOnBorder.push({ x: xAtMaxY, y: maxY });
            }
        }
        let finalP1 = null, finalP2 = null, maxDistSq = -1;
        if (pointsOnBorder.length >= 2) {
            for (let i = 0; i < pointsOnBorder.length; i++) {
                for (let j = i + 1; j < pointsOnBorder.length; j++) {
                    let dSq = sq(pointsOnBorder[i].x - pointsOnBorder[j].x) + sq(pointsOnBorder[i].y - pointsOnBorder[j].y);
                    if (dSq > maxDistSq) { maxDistSq = dSq; finalP1 = pointsOnBorder[i]; finalP2 = pointsOnBorder[j]; }
                }
            }
        }
        if (finalP1 && finalP2) line(finalP1.x, finalP1.y, finalP2.x, finalP2.y);
    }
    pop();
}

// ------------------------------------
// ゲームロジック補助関数 (既存)
// ------------------------------------
function updatePlayerNames() { /* ... (変更なし) ... */ 
    playerNames[1] = inputPlayer1Name.value().trim() || "プレイヤー1";
    if (playerNames[1] === "") playerNames[1] = "プレイヤー1";
    playerNames[2] = inputPlayer2Name.value().trim() || "プレイヤー2";
    if (playerNames[2] === "") playerNames[2] = "プレイヤー2";
    if(!gameOver && gameState !== 'confirming') updateMessageDisplay(); // 確認中はメッセージを上書きしない
}
function isStoneAt(x, y) { /* ... (変更なし) ... */ 
    return placedStones.some(stone => stone.x === x && stone.y === y);
}
function resetGame() { /* ... (gameState, previewStoneの初期化追加) ... */ 
    placedStones = [];
    currentPlayer = 1;
    gameOver = false;
    highlightedStones = [];
    conicPath = null;
    gameState = 'placing'; // ★追加
    previewStone = null;   // ★追加
    updatePlayerNames(); 
    const currentPlayerColor = currentPlayer === 1 ? '#d9534f' : '#428bca';
    select('#messageArea').html(`次は <strong style="color:${currentPlayerColor}; font-weight:700;">${playerNames[currentPlayer]}</strong> の手番です`);
    loop();
}
function areThreePointsCollinear(p1, p2, p3) { /* ... (変更なし) ... */ 
    const area2 = p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y);
    return Math.abs(area2) < 1e-7;
}
function calculateCircleFrom3Points(p1, p2, p3) { /* ... (変更なし) ... */ 
    if (areThreePointsCollinear(p1, p2, p3)) return null;
    const D = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
    if (Math.abs(D) < 1e-9) return null;
    const p1sq = p1.x * p1.x + p1.y * p1.y;
    const p2sq = p2.x * p2.x + p2.y * p2.y;
    const p3sq = p3.x * p3.x + p3.y * p3.y;
    const centerX = (p1sq * (p2.y - p3.y) + p2sq * (p3.y - p1.y) + p3sq * (p1.y - p2.y)) / D;
    const centerY = (p1sq * (p3.x - p2.x) + p2sq * (p1.x - p3.x) + p3sq * (p2.x - p1.x)) / D;
    const radius = dist(p1.x, p1.y, centerX, centerY);
    if (radius < 1e-4) return null; 
    return { center: { x: centerX, y: centerY }, radius: radius };
}
function arePointsConcyclicOrCollinear(p1, p2, p3, p4) { /* ... (変更なし) ... */ 
    const points = [p1, p2, p3, p4];
    const m = [];
    for (const p of points) { m.push([p.x * p.x + p.y * p.y, p.x, p.y, 1]); }
    const det3x3 = (a,b,c, d,e,f, g,h,i) => a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g);
    let det = 0;
    det += m[0][0] * det3x3(m[1][1], m[1][2], m[1][3], m[2][1], m[2][2], m[2][3], m[3][1], m[3][2], m[3][3]);
    det -= m[0][1] * det3x3(m[1][0], m[1][2], m[1][3], m[2][0], m[2][2], m[2][3], m[3][0], m[3][2], m[3][3]);
    det += m[0][2] * det3x3(m[1][0], m[1][1], m[1][3], m[2][0], m[2][1], m[2][3], m[3][0], m[3][1], m[3][3]);
    det -= m[0][3] * det3x3(m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2], m[3][0], m[3][1], m[3][2]);
    const EPSILON = 1e-7; return Math.abs(det) < EPSILON;
}
function getCombinations(arr, k) { /* ... (変更なし) ... */ 
    if (k < 0 || k > arr.length) return []; if (k === 0) return [[]]; if (k === arr.length) return [arr]; if (k === 1) return arr.map(item => [item]);
    const combinations = [];
    function findCombinations(startIndex, currentCombination) {
        if (currentCombination.length === k) { combinations.push([...currentCombination]); return; }
        if (startIndex >= arr.length) return;
        currentCombination.push(arr[startIndex]); findCombinations(startIndex + 1, currentCombination); currentCombination.pop();
        if (arr.length - (startIndex + 1) >= k - currentCombination.length) findCombinations(startIndex + 1, currentCombination);
    }
    findCombinations(0, []); return combinations;
}
