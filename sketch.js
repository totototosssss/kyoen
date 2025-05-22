// --- 定数定義 ---
const GRID_DIVISIONS = 15;
const CELL_SIZE = 35;
const DOT_RADIUS = CELL_SIZE * 0.42;
const STONE_COLOR = [35, 35, 35, 255]; // 石の色をさらに濃く

const CANVAS_WIDTH = GRID_DIVISIONS * CELL_SIZE + CELL_SIZE;
const CANVAS_HEIGHT = GRID_DIVISIONS * CELL_SIZE + CELL_SIZE;
const DRAW_OFFSET = CELL_SIZE / 2;

// --- グローバル変数 ---
let placedStones = [];
let currentPlayer = 1;
let playerNames = { 1: "プレイヤー1", 2: "プレイヤー2" };
let gameOver = false;
let highlightedStones = [];
let conicPath = null;

let resetButton;
let inputPlayer1Name, inputPlayer2Name;
let canvasInstance; // p5.jsのキャンバスインスタンスを保持

// ------------------------------------
// p5.js のライフサイクル関数
// ------------------------------------
function setup() {
    canvasInstance = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    // HTMLの構成に合わせて、キャンバスをボタンの前に挿入
    let controlsDiv = select('.controls');
    if (controlsDiv) {
        canvasInstance.parent(controlsDiv.elt.parentNode, controlsDiv.elt.nextSibling); // controlsDiv の次に canvas を配置
    }


    textFont('Inter, Noto Sans JP, sans-serif'); // フォント指定

    resetButton = select('#resetButton');
    resetButton.mousePressed(resetGame);

    inputPlayer1Name = select('#player1NameInput');
    inputPlayer2Name = select('#player2NameInput');
    inputPlayer1Name.input(updatePlayerNames);
    inputPlayer2Name.input(updatePlayerNames);

    textAlign(CENTER, CENTER);
    updatePlayerNames();
    resetGame();
}

function draw() {
    background(238, 241, 245); // HTML背景色と調和
    translate(DRAW_OFFSET, DRAW_OFFSET);

    drawGrid();
    if (gameOver && conicPath) {
        drawConicPath();
    }
    drawStones();

    // キャンバス上のゲームオーバーメッセージは削除
    // if (gameOver) {
    //     drawGameOverMessage(); // この関数は削除またはコメントアウト
    // }

    resetMatrix(); // translateをリセット
    updateMessageDisplay(); // メッセージは常にHTML側で更新
}

function mousePressed() {
    if (gameOver) return;
    // マウスがキャンバス内にあるかチェック
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
        return;
    }

    let boardMouseX = mouseX - DRAW_OFFSET;
    let boardMouseY = mouseY - DRAW_OFFSET;
    let gridX = Math.round(boardMouseX / CELL_SIZE);
    let gridY = Math.round(boardMouseY / CELL_SIZE);

    if (gridX >= 0 && gridX <= GRID_DIVISIONS &&
        gridY >= 0 && gridY <= GRID_DIVISIONS) {
        if (!isStoneAt(gridX, gridY)) {
            const newStone = { x: gridX, y: gridY };
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
                    gameOver = true;
                } else {
                    currentPlayer = (currentPlayer === 1) ? 2 : 1;
                }
            }
        }
    }
}

// ------------------------------------
// 描画関連関数
// ------------------------------------
function drawGrid() {
    stroke(190, 195, 205); // グリッド線の色
    strokeWeight(1);
    for (let i = 0; i <= GRID_DIVISIONS; i++) {
        line(i * CELL_SIZE, 0, i * CELL_SIZE, GRID_DIVISIONS * CELL_SIZE);
        line(0, i * CELL_SIZE, GRID_DIVISIONS * CELL_SIZE, i * CELL_SIZE);
    }

    if (GRID_DIVISIONS === 12) {
      let starPoints = [ {x:3, y:3}, {x:3, y:9}, {x:9, y:3}, {x:9, y:9}, {x:6, y:6} ];
      fill(170, 175, 185); // 星の色
      noStroke();
      for (const p of starPoints) {
          ellipse(p.x * CELL_SIZE, p.y * CELL_SIZE, DOT_RADIUS * 0.2, DOT_RADIUS * 0.2);
      }
    }
}

function drawStones() {
    for (const stone of placedStones) {
        // 簡易的な影
        fill(0, 0, 0, 30); // さらに薄い影
        noStroke();
        ellipse(
            stone.x * CELL_SIZE + 1.5, // オフセット微調整
            stone.y * CELL_SIZE + 1.5,
            DOT_RADIUS * 2,
            DOT_RADIUS * 2
        );

        // 石本体
        fill(STONE_COLOR[0], STONE_COLOR[1], STONE_COLOR[2], STONE_COLOR[3]);
        
        // ハイライト (左上からの光)
        fill(255, 255, 255, 50); // 半透明の白
        ellipse(
            stone.x * CELL_SIZE - DOT_RADIUS * 0.35,
            stone.y * CELL_SIZE - DOT_RADIUS * 0.35,
            DOT_RADIUS, // ハイライトのサイズを調整
            DOT_RADIUS
        );
        
        // 石本体を再描画 (ハイライトが内側に収まるようにするため、fillを戻す)
        fill(STONE_COLOR[0], STONE_COLOR[1], STONE_COLOR[2], STONE_COLOR[3]);

        if (gameOver && highlightedStones.some(hs => hs.x === stone.x && hs.y === stone.y)) {
            stroke(255, 200, 0); // 強調用のオレンジゴールド系
            strokeWeight(3);
        } else {
            noStroke();
        }
        ellipse(
            stone.x * CELL_SIZE,
            stone.y * CELL_SIZE,
            DOT_RADIUS * 2,
            DOT_RADIUS * 2
        );
    }
    noStroke();
}

// drawGameOverMessage() はHTMLに集約するため削除

function updateMessageDisplay() {
    let gameOverTitleHtml = "";
    let turnOrWinnerHtml = "";

    if (gameOver) {
        const loserName = playerNames[currentPlayer];
        const winnerNum = (currentPlayer === 1) ? 2 : 1;
        const winnerName = playerNames[winnerNum];

        if (highlightedStones.length > 0) {
             gameOverTitleHtml = `<strong style="font-size:1.5em; color: #e74c3c; display:block; margin-bottom:5px;">共円成立！</strong>`;
             turnOrWinnerHtml = `<span style="font-size:1.1em;">${loserName} が配置。<br><strong style="color: #27ae60;">${winnerName} の勝利！</strong></span>`;
        } else {
            gameOverTitleHtml = `<strong style="font-size: 1.5em; display:block; margin-bottom:5px;">引き分け！</strong>`;
            turnOrWinnerHtml = `<span style="font-size:1.1em;">全てのマスが埋まりました。</span>`;
        }
    } else {
        const currentPlayerColor = currentPlayer === 1 ? '#d9534f' : '#428bca'; // より明確な色
        turnOrWinnerHtml = `次は <strong style="color:${currentPlayerColor}; font-weight:700;">${playerNames[currentPlayer]}</strong> の手番です`;
    }
    select('#messageArea').html(gameOverTitleHtml + turnOrWinnerHtml);
}

// ------------------------------------
// 共円/直線 表示準備と描画 (直線判定の修正)
// ------------------------------------
function prepareConicPathToDraw() {
    if (highlightedStones.length < 4) {
        conicPath = null;
        return;
    }
    const [p1, p2, p3, p4] = highlightedStones;

    // 4点が同一直線上にあるか判定 (より確実な方法)
    // 3点(p1,p2,p3)が直線 && 3点(p1,p2,p4)が直線 (p1,p2は異なる2点とする)
    // または、全ての点のペアの傾きが（ほぼ）等しいなど。
    // ここでは、p1,p2,p3が直線で、かつp4がその直線に乗っているかで判定
    if (areThreePointsCollinear(p1, p2, p3) && areThreePointsCollinear(p1, p2, p4) && areThreePointsCollinear(p1,p3,p4) && areThreePointsCollinear(p2,p3,p4) ) {
        console.log("直線として処理 (4点共線):", highlightedStones);
        // x座標でソートし、同値ならy座標でソートして両端を取る
        let sortedStones = [...highlightedStones].sort((a, b) => {
            if (a.x !== b.x) return a.x - b.x;
            return a.y - b.y;
        });
        conicPath = { type: 'line', data: { p_start: sortedStones[0], p_end: sortedStones[3] } };
    } else { // 直線でなければ円 (のはず)
        console.log("円として処理の可能性:", highlightedStones);
        let circleData = null;
        const combos3 = getCombinations(highlightedStones, 3);
        for (const combo of combos3) {
            const [c1, c2, c3] = combo;
            if (!areThreePointsCollinear(c1, c2, c3)) { // この3点が直線でない場合のみ円を計算
                circleData = calculateCircleFrom3Points(c1, c2, c3);
                if (circleData) {
                    // 残り1点がこの円周上にあるか確認 (arePointsConcyclicOrCollinearで確認済みのはず)
                    const fourthPoint = highlightedStones.find(p =>
                        p.x !== c1.x || p.y !== c1.y &&
                        p.x !== c2.x || p.y !== c2.y &&
                        p.x !== c3.x || p.y !== c3.y
                    );
                    if (fourthPoint) {
                        const d = dist(fourthPoint.x, fourthPoint.y, circleData.center.x, circleData.center.y);
                        // 許容誤差は半径の数%程度か、固定値
                        const tolerance = Math.max(0.1, circleData.radius * 0.05); // 半径が小さい場合は固定誤差
                        if (Math.abs(d - circleData.radius) < tolerance) {
                            break; // 適切な円が見つかった
                        }
                    }
                    circleData = null; // 4点目が乗らない or fourthPointが見つからない場合は不適切
                }
            }
        }

        if (circleData) {
            conicPath = { type: 'circle', data: circleData };
        } else {
            // 行列式では共円/直線だが、上記の詳細判定でどちらも明確に特定できなかった場合
            // (浮動小数点誤差などが原因で発生しうる)
            // この場合、フォールバックとして最も可能性の高いものを描画するか、何もしない
            console.warn("最終的に円も直線も特定できませんでした。highlightedStones:", highlightedStones);
            // デバッグ用に、強制的に直線を引いてみる
            let sortedStones = [...highlightedStones].sort((a,b) => (a.x - b.x) || (a.y - b.y));
            conicPath = { type: 'line', data: {p_start: sortedStones[0], p_end: sortedStones[3] } };
            // conicPath = null; // 本番ではnullが良いかも
        }
    }
    // console.log("最終的なconicPath:", conicPath);
}


function drawConicPath() {
    if (!conicPath || !conicPath.data) return;

    push();
    strokeWeight(3.5); // 少し太く
    noFill();
    // 線の色をより目立つように
    let pathColor = color(255, 69, 0, 220); // オレンジレッド系、少し透明度

    if (conicPath.type === 'circle' && conicPath.data.center && conicPath.data.radius > 0) {
        stroke(pathColor);
        ellipseMode(CENTER);
        ellipse(
            conicPath.data.center.x * CELL_SIZE,
            conicPath.data.center.y * CELL_SIZE,
            conicPath.data.radius * 2 * CELL_SIZE,
            conicPath.data.radius * 2 * CELL_SIZE
        );
    // --- ここから書き換え部分 ---
    } else if (conicPath.type === 'line' && conicPath.data.p_start && conicPath.data.p_end) {
        stroke(pathColor);
        
        // 格子座標をピクセル座標に変換
        let p1_px = { 
            x: conicPath.data.p_start.x * CELL_SIZE, 
            y: conicPath.data.p_start.y * CELL_SIZE 
        };
        let p2_px = { 
            x: conicPath.data.p_end.x * CELL_SIZE, 
            y: conicPath.data.p_end.y * CELL_SIZE 
        };

        // 盤面の境界 (translate後の描画座標系)
        const minX = 0;
        const maxX = GRID_DIVISIONS * CELL_SIZE;
        const minY = 0;
        const maxY = GRID_DIVISIONS * CELL_SIZE;

        let pointsOnBorder = [];

        if (Math.abs(p1_px.x - p2_px.x) < 1e-6) { // 垂直な直線 x = C
            pointsOnBorder.push({ x: p1_px.x, y: minY });
            pointsOnBorder.push({ x: p1_px.x, y: maxY });
        } else if (Math.abs(p1_px.y - p2_px.y) < 1e-6) { // 水平な直線 y = C
            pointsOnBorder.push({ x: minX, y: p1_px.y });
            pointsOnBorder.push({ x: maxX, y: p1_px.y });
        } else { // 斜めの直線
            const slope = (p2_px.y - p1_px.y) / (p2_px.x - p1_px.x);
            const yIntercept = p1_px.y - slope * p1_px.x; // y = slope * x + yIntercept

            // y = slope * x + yIntercept
            // x = (y - yIntercept) / slope

            // 境界 x = minX との交点
            let yAtMinX = slope * minX + yIntercept;
            if (yAtMinX >= minY && yAtMinX <= maxY) {
                pointsOnBorder.push({ x: minX, y: yAtMinX });
            }

            // 境界 x = maxX との交点
            let yAtMaxX = slope * maxX + yIntercept;
            if (yAtMaxX >= minY && yAtMaxX <= maxY) {
                pointsOnBorder.push({ x: maxX, y: yAtMaxX });
            }

            // 境界 y = minY との交点
            if (Math.abs(slope) > 1e-6) { // slopeが0でない（水平でない）
                let xAtMinY = (minY - yIntercept) / slope;
                if (xAtMinY >= minX && xAtMinY <= maxX) {
                    pointsOnBorder.push({ x: xAtMinY, y: minY });
                }
            }
            
            // 境界 y = maxY との交点
            if (Math.abs(slope) > 1e-6) { // slopeが0でない（水平でない）
                let xAtMaxY = (maxY - yIntercept) / slope;
                if (xAtMaxY >= minX && xAtMaxY <= maxX) {
                    pointsOnBorder.push({ x: xAtMaxY, y: maxY });
                }
            }
            // 重複する可能性のある点をフィルタリング (実数比較なので誤差に注意)
            // 簡単のため、ここでは重複フィルタは省略。通常2点が見つかるはず。
            // より堅牢にするなら、点をx,yでソートしてユニークにするなど。
        }
        
        // 描画する点が2つ見つかった場合のみ線を描画
        if (pointsOnBorder.length >= 2) {
            // 通常はちょうど2点になる。3点以上になるのは稀なケース(角を通るなど)だが、
            // その場合でも最初と最後の2点を取るなどで対応可能。
            // ここでは単純に最初の2点を取る。
            // (もしpointsOnBorderが4点などになる場合は、その中から最も離れた2点を選ぶロジックが必要)
            // 実際には、有効な交点は最大でも2つのはず。
            
            // pointsOnBorderの中から距離が最も離れた2点を選ぶ方が確実
            let finalP1 = null, finalP2 = null, maxDistSq = -1;
            if (pointsOnBorder.length >= 2) {
                for (let i = 0; i < pointsOnBorder.length; i++) {
                    for (let j = i + 1; j < pointsOnBorder.length; j++) {
                        let dSq = sq(pointsOnBorder[i].x - pointsOnBorder[j].x) + 
                                sq(pointsOnBorder[i].y - pointsOnBorder[j].y);
                        if (dSq > maxDistSq) {
                            maxDistSq = dSq;
                            finalP1 = pointsOnBorder[i];
                            finalP2 = pointsOnBorder[j];
                        }
                    }
                }
            }

            if (finalP1 && finalP2) {
                line(finalP1.x, finalP1.y, finalP2.x, finalP2.y);
            } else if (pointsOnBorder.length >=2) { // フォールバック (上記ロジックがうまく行かなかった場合)
                line(pointsOnBorder[0].x, pointsOnBorder[0].y, pointsOnBorder[1].x, pointsOnBorder[1].y);
            } else {
                // 念のため、元のp_start, p_endで描画 (デバッグ用)
                // console.warn("直線突き抜け描画で適切な境界交点が見つかりませんでした。元の線で描画します。");
                // line(p1_px.x, p1_px.y, p2_px.x, p2_px.y);
            }
        } else {
            // 元の線分を描画 (フォールバック)
            // console.warn("直線突き抜け描画で境界交点が2つ未満でした。元の線で描画します。");
            // line(p1_px.x, p1_px.y, p2_px.x, p2_px.y);
        }
    }
    // --- ここまでが書き換え部分 ---
    pop();
}

// ------------------------------------
// ゲームロジック補助関数 (変更なし/微修正)
// ------------------------------------
function updatePlayerNames() {
    playerNames[1] = inputPlayer1Name.value().trim() || "プレイヤー1";
    if (playerNames[1] === "") playerNames[1] = "プレイヤー1";
    playerNames[2] = inputPlayer2Name.value().trim() || "プレイヤー2";
    if (playerNames[2] === "") playerNames[2] = "プレイヤー2";

    if(!gameOver) updateMessageDisplay();
}

function isStoneAt(x, y) {
    return placedStones.some(stone => stone.x === x && stone.y === y);
}

function resetGame() {
    placedStones = [];
    currentPlayer = 1;
    gameOver = false;
    highlightedStones = [];
    conicPath = null;
    updatePlayerNames(); // 先に名前を更新
    // メッセージエリアの初期化
    const currentPlayerColor = currentPlayer === 1 ? '#d9534f' : '#428bca';
    select('#messageArea').html(`次は <strong style="color:${currentPlayerColor}; font-weight:700;">${playerNames[currentPlayer]}</strong> の手番です`);
    loop();
}

function areThreePointsCollinear(p1, p2, p3) {
    const area2 = p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y);
    return Math.abs(area2) < 1e-7;
}

function calculateCircleFrom3Points(p1, p2, p3) {
    if (areThreePointsCollinear(p1, p2, p3)) return null;

    const D = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
    if (Math.abs(D) < 1e-9) return null;

    const p1sq = p1.x * p1.x + p1.y * p1.y;
    const p2sq = p2.x * p2.x + p2.y * p2.y;
    const p3sq = p3.x * p3.x + p3.y * p3.y;

    const centerX = (p1sq * (p2.y - p3.y) + p2sq * (p3.y - p1.y) + p3sq * (p1.y - p2.y)) / D;
    const centerY = (p1sq * (p3.x - p2.x) + p2sq * (p1.x - p3.x) + p3sq * (p2.x - p1.x)) / D;
    const radius = dist(p1.x, p1.y, centerX, centerY);

    if (radius < 1e-4) return null; // 半径が小さすぎる場合は無効 (ほぼ点が重なっている)

    return { center: { x: centerX, y: centerY }, radius: radius };
}

// arePointsConcyclicOrCollinear と getCombinations は変更なし
function arePointsConcyclicOrCollinear(p1, p2, p3, p4) {
    const points = [p1, p2, p3, p4];
    const m = [];
    for (const p of points) {
        m.push([p.x * p.x + p.y * p.y, p.x, p.y, 1]);
    }
    const det3x3 = (a,b,c, d,e,f, g,h,i) => a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g);
    let det = 0;
    det += m[0][0] * det3x3(m[1][1], m[1][2], m[1][3], m[2][1], m[2][2], m[2][3], m[3][1], m[3][2], m[3][3]);
    det -= m[0][1] * det3x3(m[1][0], m[1][2], m[1][3], m[2][0], m[2][2], m[2][3], m[3][0], m[3][2], m[3][3]);
    det += m[0][2] * det3x3(m[1][0], m[1][1], m[1][3], m[2][0], m[2][1], m[2][3], m[3][0], m[3][1], m[3][3]);
    det -= m[0][3] * det3x3(m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2], m[3][0], m[3][1], m[3][2]);
    const EPSILON = 1e-7;
    return Math.abs(det) < EPSILON;
}
function getCombinations(arr, k) {
    if (k < 0 || k > arr.length) return [];
    if (k === 0) return [[]];
    if (k === arr.length) return [arr];
    if (k === 1) return arr.map(item => [item]);
    const combinations = [];
    function findCombinations(startIndex, currentCombination) {
        if (currentCombination.length === k) {
            combinations.push([...currentCombination]);
            return;
        }
        if (startIndex >= arr.length) return;
        currentCombination.push(arr[startIndex]);
        findCombinations(startIndex + 1, currentCombination);
        currentCombination.pop();
        if (arr.length - (startIndex + 1) >= k - currentCombination.length) {
            findCombinations(startIndex + 1, currentCombination);
        }
    }
    findCombinations(0, []);
    return combinations;
}