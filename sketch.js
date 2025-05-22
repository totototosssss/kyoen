// --- Constants & Global Variables ---
// const GRID_DIVISIONS = 10; // ★ 定数から変数へ変更
let GRID_DIVISIONS = 10;    // Default value, will be updated
const CELL_SIZE = 35;       // Cell size remains constant for now
const DOT_RADIUS = CELL_SIZE * 0.42;

// ★ CANVAS_WIDTH, CANVAS_HEIGHT, DRAW_OFFSET は let になり、resetGameで再計算
let CANVAS_WIDTH = GRID_DIVISIONS * CELL_SIZE + CELL_SIZE;
let CANVAS_HEIGHT = GRID_DIVISIONS * CELL_SIZE + CELL_SIZE;
let DRAW_OFFSET = CELL_SIZE / 2;

const ACTION_BUTTON_HEIGHT = CELL_SIZE * 1.25;
const ACTION_BUTTON_WIDTH = CELL_SIZE * 3.8;
const ACTION_BUTTON_PADDING = 12;

// (他のグローバル変数は変更なし)
let placedStones = [];
let currentPlayer = 1;
let playerNames = { 1: "Player 1", 2: "Player 2" };
let gameOver = false;
let gameOverReason = null;
let highlightedStones = [];
let conicPath = null;
let resetButton;
let inputPlayer1Name, inputPlayer2Name;
let canvasInstance;

let gameState = 'SELECTING_SPOT';
let previewStone = null;
let placementOkButton, placementCancelButton;
let challengeButtonContainerElement;
let challengeButtonImgElement;

let challengeRuleCheckbox;
let challengeRuleActive = false;
let lastPlacedStoneForChallenge = null;
let stoneDisplayImage;
let boardSizeSelectElement; // ★ 盤サイズ選択要素

// ------------------------------------
// p5.js Lifecycle Functions
// ------------------------------------
function preload() {
    console.log("Preload started...");
    stoneDisplayImage = loadImage(
        'stone.png',
        () => console.log("SUCCESS: Stone image ('stone.png') loaded!"),
        (errEvent) => {
            console.error("ERROR: Failed to load stone image ('stone.png'). Check filename/path and ensure local server is used. Actual error:", errEvent);
            alert("CRITICAL ERROR: Could not load 'stone.png'.\nGame may not display stones correctly.\nEnsure the file is in the same folder and you're using a local server.");
        }
    );
    console.log("Preload finished.");
}

function setup() {
    console.log("Setup started...");

    boardSizeSelectElement = select('#boardSizeSelect'); // ★ サイズセレクタを取得
    if (boardSizeSelectElement) {
        GRID_DIVISIONS = parseInt(boardSizeSelectElement.value()); // ★ 初期値を読み込む
        boardSizeSelectElement.changed(resetGame); // ★ サイズ変更時にもresetGameを呼ぶ
    } else {
        console.error("Setup ERROR: Board size select element not found.");
        // GRID_DIVISIONS はデフォルト値のまま
    }

    // ★ GRID_DIVISIONS に基づいてキャンバス関連の値を計算
    CANVAS_WIDTH = GRID_DIVISIONS * CELL_SIZE + CELL_SIZE;
    CANVAS_HEIGHT = GRID_DIVISIONS * CELL_SIZE + CELL_SIZE;
    DRAW_OFFSET = CELL_SIZE / 2; // CELL_SIZEが固定ならDRAW_OFFSETも固定

    canvasInstance = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    let canvasContainer = select('#canvas-container');
    if (canvasContainer) {
        canvasInstance.parent('canvas-container');
        console.log("Setup: Canvas parented to #canvas-container.");
    } else {
        console.error("Setup ERROR: #canvas-container div not found!");
    }

    textFont('Inter, Roboto, sans-serif');
    
    resetButton = select('#resetButton');
    if(resetButton) resetButton.mousePressed(resetGame); else console.error("Setup ERROR: Reset button not found.");

    inputPlayer1Name = select('#player1NameInput');
    inputPlayer2Name = select('#player2NameInput');
    if(inputPlayer1Name) inputPlayer1Name.input(updatePlayerNames); else console.error("Setup ERROR: Player 1 name input not found.");
    if(inputPlayer2Name) inputPlayer2Name.input(updatePlayerNames); else console.error("Setup ERROR: Player 2 name input not found.");

    challengeRuleCheckbox = select('#challengeRuleCheckbox');
    if(challengeRuleCheckbox) {
        challengeRuleCheckbox.changed(() => {
            challengeRuleActive = challengeRuleCheckbox.checked();
            resetGame(); // ルール変更時もゲームリセット
        });
        challengeRuleActive = challengeRuleCheckbox.checked();
    } else {
        console.error("Setup ERROR: Challenge rule checkbox not found.");
    }

    // ボタン位置はresetGameで設定するように変更
    placementOkButton = { x: 0, y: 0, w: ACTION_BUTTON_WIDTH, h: ACTION_BUTTON_HEIGHT, label: "Place" };
    placementCancelButton = { x: 0, y: 0, w: ACTION_BUTTON_WIDTH, h: ACTION_BUTTON_HEIGHT, label: "Cancel" };
    
    challengeButtonContainerElement = select('#challengeButtonContainer');
    challengeButtonImgElement = select('#challengeButtonImg');
    if (challengeButtonImgElement) {
        challengeButtonImgElement.mousePressed(resolveChallenge);
    } else {
        console.error("Setup ERROR: Challenge button image element not found.");
    }

    textAlign(CENTER, CENTER);
    imageMode(CENTER);
    
    updatePlayerNames();
    resetGame(); // 初期化（ここでボタン位置なども計算される）
    console.log("Setup: Finished successfully.");
}

function draw() { /* ... (変更なし) ... */ } // 描画内容は resetGame でサイズが確定してから
function mousePressed() { /* ... (変更なし) ... */ }

// ------------------------------------
// ボタン描画 (変更なし)
// ------------------------------------
function drawPlacementConfirmButtons() { /* ... (変更なし) ... */ }
function isButtonClicked(button, mx, my) { /* ... (変更なし) ... */ }

// ------------------------------------
// 石の配置とチャレンジ関連ロジック (変更なし)
// ------------------------------------
function handleStonePlacementConfirmed(stoneToPlace) { /* ... (変更なし) ... */ }
function resolveChallenge() { /* ... (変更なし) ... */ }

// ------------------------------------
// メッセージ表示 (★ 座標表示を削除)
// ------------------------------------
function updateMessageDisplay() {
    let titleHtml = ""; 
    let detailHtml = "";
    // const p1Name = playerNames[1]; // updatePlayerNamesで設定済み
    // const p2Name = playerNames[2];

    if (gameOver) {
        const winnerName = playerNames[currentPlayer]; 
        const loserNum = (currentPlayer === 1) ? 2 : 1;
        const loserName = playerNames[loserNum];

        switch (gameOverReason) {
            case 'auto_concyclic_lose': titleHtml = `<strong style="font-size:1.6em;color:#e74c3c;display:block;margin-bottom:4px;">Concentric Set!</strong>`; detailHtml = `${loserName} formed a concentric set.<br><strong style="font-size:1.3em;color:#27ae60;">${winnerName} wins!</strong>`; break;
            case 'challenge_won': titleHtml = `<strong style="font-size:1.6em;color:#27ae60;display:block;margin-bottom:4px;">Challenge Successful!</strong>`; detailHtml = `${winnerName}'s challenge was correct.<br><strong style="font-size:1.3em;color:#27ae60;">${winnerName} wins!</strong>`; break;
            case 'challenge_failed': titleHtml = `<strong style="font-size:1.6em;color:#e74c3c;display:block;margin-bottom:4px;">Challenge Failed!</strong>`; detailHtml = `${loserName}'s challenge was incorrect.<br><strong style="font-size:1.3em;color:#27ae60;">${winnerName} wins!</strong>`; break;
            case 'board_full_draw': titleHtml = `<strong style="font-size:1.6em;display:block;margin-bottom:4px;">Draw</strong>`; detailHtml = `<span style="font-size:1.1em;">All spaces are filled.</span>`; break;
            default: titleHtml = `<strong style="font-size:1.6em;display:block;margin-bottom:4px;">Game Over</strong>`; detailHtml = `<span style="font-size:1.1em;">Result undetermined.</span>`;
        }
    } else if (gameState === 'CONFIRMING_SPOT' && previewStone) {
        const targetPlayerName = playerNames[currentPlayer];
        const targetPlayerColor = currentPlayer === 1 ? '#e06c75' : '#61afef';
        // ★★★ 座標表示を削除 ★★★
        detailHtml = `Place stone here?<br><strong style="color:${targetPlayerColor};font-weight:700;">${targetPlayerName}</strong>, confirm placement?`;
    } else if (gameState === 'AWAITING_CHALLENGE' && challengeRuleActive) {
        const chN = playerNames[currentPlayer]; const plN = playerNames[(currentPlayer === 1) ? 2 : 1]; const chC = currentPlayer === 1 ? '#e06c75' : '#61afef';
        detailHtml = `${plN} placed a stone.<br><strong style="color:${chC};font-weight:700;">${chN}</strong>, challenge this move?<br><small>(Or click board to place your stone)</small>`;
    } else { // SELECTING_SPOT
        const cpC = currentPlayer === 1 ? '#e06c75' : '#61afef';
        detailHtml = `Next turn: <strong style="color:${cpC};font-weight:700;">${playerNames[currentPlayer]}</strong>.<br>Choose a spot to place your stone.`;
    }
    let msgArea = select('#messageArea');
    if (msgArea) msgArea.html(titleHtml + detailHtml); else console.error("Message area not found for updating display.");
}

// ------------------------------------
// 描画関数 (Grid, Stones, Preview - ★ Gridの星を動的化)
// ------------------------------------
function drawPreviewStone() { /* ... (変更なし) ... */ }
function drawGrid() { 
    stroke(205,210,220); strokeWeight(1.5);
    for(let i=0;i<=GRID_DIVISIONS;i++){ // ★ GRID_DIVISIONS を使用
        line(i*CELL_SIZE,0,i*CELL_SIZE,GRID_DIVISIONS*CELL_SIZE);
        line(0,i*CELL_SIZE,GRID_DIVISIONS*CELL_SIZE,i*CELL_SIZE);
    }
    
    // ★ 星の描画を動的に調整
    if (GRID_DIVISIONS >= 8) { // ある程度の大きさの盤にのみ星を表示
        let starPoints = [];
        const quarter = Math.round(GRID_DIVISIONS / 4);
        const threeQuarters = GRID_DIVISIONS - quarter; // Math.round(GRID_DIVISIONS * 3 / 4) でも良い
        const center = Math.round(GRID_DIVISIONS / 2);

        starPoints.push({x: quarter, y: quarter});
        starPoints.push({x: threeQuarters, y: quarter});
        starPoints.push({x: quarter, y: threeQuarters});
        starPoints.push({x: threeQuarters, y: threeQuarters});
        if (GRID_DIVISIONS % 2 === 0) { // 偶数分割 (奇数交点) なら中央にも
            starPoints.push({x: center, y: center});
        }
        // 辺の中央にも追加する場合 (例: 19路盤の9つの星)
        if (GRID_DIVISIONS >= 12) { // 例えば13路盤以上なら
            starPoints.push({x: quarter, y: center});
            starPoints.push({x: threeQuarters, y: center});
            starPoints.push({x: center, y: quarter});
            starPoints.push({x: center, y: threeQuarters});
        }
        // 重複する可能性があるのでユニークにする (GRID_DIVISIONSが小さい場合など)
        starPoints = starPoints.filter((point, index, self) =>
            index === self.findIndex((p) => (
                p.x === point.x && p.y === point.y
            ))
        );

        fill(180,185,195); noStroke();
        for(const p of starPoints) ellipse(p.x*CELL_SIZE,p.y*CELL_SIZE,DOT_RADIUS*0.25,DOT_RADIUS*0.25);
    }
}
function drawStones() { /* ... (変更なし) ... */ }

// ------------------------------------
// ゲームロジック補助関数 (★ resetGame でサイズとボタン位置を再計算)
// ------------------------------------
function updatePlayerNames() { /* ... (変更なし) ... */ }
function isStoneAt(x, y) { /* ... (変更なし) ... */ }
function resetGame() {
    console.log("Resetting game...");
    if (boardSizeSelectElement) {
        GRID_DIVISIONS = parseInt(boardSizeSelectElement.value()); // ★ サイズ読み込み
        console.log("Board size set to divisions:", GRID_DIVISIONS);
    } else {
        GRID_DIVISIONS = 10; // フォールバック
        console.warn("Board size select not found, defaulting to 10 divisions.");
    }

    // ★ キャンバスサイズと関連定数を再計算
    CANVAS_WIDTH = GRID_DIVISIONS * CELL_SIZE + CELL_SIZE;
    CANVAS_HEIGHT = GRID_DIVISIONS * CELL_SIZE + CELL_SIZE;
    // DRAW_OFFSET は CELL_SIZE に依存するので、CELL_SIZEが固定なら変わらない
    
    if (canvasInstance) {
        resizeCanvas(CANVAS_WIDTH, CANVAS_HEIGHT); // ★ キャンバスサイズ変更
        console.log("Canvas resized to:", CANVAS_WIDTH, "x", CANVAS_HEIGHT);
    } else {
        // setupでcanvasInstanceが取得できなかった場合など (通常はありえない)
        canvasInstance = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        let canvasContainer = select('#canvas-container');
        if (canvasContainer) canvasInstance.parent('canvas-container');
    }
    
    // ★ ボタン位置を再計算 (p5.js の width/height は resizeCanvas で更新される)
    const buttonYPos = height - ACTION_BUTTON_HEIGHT - ACTION_BUTTON_PADDING;
    const totalPlacementButtonWidth = ACTION_BUTTON_WIDTH * 2 + ACTION_BUTTON_PADDING;
    const placementButtonStartX = (width - totalPlacementButtonWidth) / 2;
    placementOkButton.x = placementButtonStartX;
    placementOkButton.y = buttonYPos;
    placementCancelButton.x = placementButtonStartX + ACTION_BUTTON_WIDTH + ACTION_BUTTON_PADDING;
    placementCancelButton.y = buttonYPos;
    // challengeButtonObject はHTML要素なので、p5.jsのwidth/heightには直接依存しない (CSSで中央揃え)
    // ただし、そのコンテナの位置を調整したい場合はここで行う。今回はCSSに任せる。

    placedStones = []; currentPlayer = 1; gameOver = false; gameOverReason = null;
    highlightedStones = []; conicPath = null; previewStone = null;
    lastPlacedStoneForChallenge = null;
    if (challengeRuleCheckbox) challengeRuleActive = challengeRuleCheckbox.checked(); else challengeRuleActive = false;
    
    gameState = 'SELECTING_SPOT';
    updatePlayerNames(); // updatePlayerNamesを先に呼んで名前を確定
    
    const cpc = currentPlayer === 1 ? '#e06c75' : '#61afef';
    let initialMessage = `Next turn: <strong style="color:${cpc}; font-weight:700;">${playerNames[currentPlayer]}</strong>.<br>Choose a spot to place your stone.`;
    if (challengeRuleActive) {
        initialMessage += `<br><small style="font-size:0.85em; color:#555e68;">(Challenge Rule Enabled)</small>`;
    }
    let msgArea = select('#messageArea');
    if (msgArea) msgArea.html(initialMessage); else console.error("Message area not found for reset message.");
    
    if (challengeButtonContainerElement) challengeButtonContainerElement.style('display', 'none');
    if (boardSizeSelectElement) boardSizeSelectElement.removeAttribute('disabled'); // ★ サイズ選択を有効化

    console.log("Game reset. Initial gameState:", gameState, "Challenge Rule:", challengeRuleActive);
    if (isLooping()) {
        // draw()が既にループしていれば何もしない
    } else {
        loop(); 
    }
    // redraw(); // 盤面を即座に再描画する
}

// handleStonePlacementConfirmed 内でゲームが開始されたらサイズセレクタを無効化
function handleStonePlacementConfirmed(stoneToPlace) {
    if (boardSizeSelectElement) boardSizeSelectElement.attribute('disabled', 'true'); // ★ サイズ選択を無効化
    // ... (既存の石配置と勝敗判定ロジック) ...
    // (前回からの変更なし。ただし、勝敗決定時の currentPlayer の調整は重要)
    placedStones.push({...stoneToPlace});
    lastPlacedStoneForChallenge = {...stoneToPlace};
    previewStone = null;
    if (challengeRuleActive) {
        currentPlayer = (currentPlayer === 1) ? 2 : 1;
        gameState = 'AWAITING_CHALLENGE';
    } else { 
        let concyclicMade = false;
        if (placedStones.length >= 4) {
            const combinations = getCombinations(placedStones, 4);
            for (const combo of combinations) {
                let newStoneInCombo = combo.some(s => s.x === stoneToPlace.x && s.y === stoneToPlace.y);
                if (newStoneInCombo && arePointsConcyclicOrCollinear(combo[0], combo[1], combo[2], combo[3])) {
                    gameOver = true; gameOverReason = 'auto_concyclic_lose'; highlightedStones = [...combo]; prepareConicPathToDraw();
                    currentPlayer = (currentPlayer === 1) ? 2 : 1; // 勝者をセット
                    concyclicMade = true; break;
                }
            }
        }
        if (gameOver) gameState = 'GAME_OVER';
        else {
            if (placedStones.length === (GRID_DIVISIONS + 1) * (GRID_DIVISIONS + 1)) {
                gameOver = true; gameOverReason = 'board_full_draw'; gameState = 'GAME_OVER';
            } else {
                currentPlayer = (currentPlayer === 1) ? 2 : 1; gameState = 'SELECTING_SPOT';
            }
        }
    }
}


// ------------------------------------
// Geometric Calculation Functions (変更なし)
// ------------------------------------
function areThreePointsCollinear(p1,p2,p3){const a2=p1.x*(p2.y-p3.y)+p2.x*(p3.y-p1.y)+p3.x*(p1.y-p2.y);return Math.abs(a2)<1e-7;}
function calculateCircleFrom3Points(p1,p2,p3){if(areThreePointsCollinear(p1,p2,p3))return null;const D=2*(p1.x*(p2.y-p3.y)+p2.x*(p3.y-p1.y)+p3.x*(p1.y-p2.y));if(Math.abs(D)<1e-9)return null;const p1s=p1.x*p1.x+p1.y*p1.y;const p2s=p2.x*p2.x+p2.y*p2.y;const p3s=p3.x*p3.x+p3.y*p3.y;const cX=(p1s*(p2.y-p3.y)+p2s*(p3.y-p1.y)+p3s*(p1.y-p2.y))/D;const cY=(p1s*(p3.x-p2.x)+p2s*(p1.x-p3.x)+p3s*(p2.x-p1.x))/D;const r=dist(p1.x,p1.y,cX,cY);if(r<1e-4)return null;return{center:{x:cX,y:cY},radius:r};}
function arePointsConcyclicOrCollinear(p1,p2,p3,p4){const ps=[p1,p2,p3,p4];const m=[];for(const p of ps){m.push([p.x*p.x+p.y*p.y,p.x,p.y,1]);}const d3=(a,b,c,d,e,f,g,h,i)=>a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);let det=0;det+=m[0][0]*d3(m[1][1],m[1][2],m[1][3],m[2][1],m[2][2],m[2][3],m[3][1],m[3][2],m[3][3]);det-=m[0][1]*d3(m[1][0],m[1][2],m[1][3],m[2][0],m[2][2],m[2][3],m[3][0],m[3][2],m[3][3]);det+=m[0][2]*d3(m[1][0],m[1][1],m[1][3],m[2][0],m[2][1],m[2][3],m[3][0],m[3][1],m[3][3]);det-=m[0][3]*d3(m[1][0],m[1][1],m[1][2],m[2][0],m[2][1],m[2][2],m[3][0],m[3][1],m[3][2]);return Math.abs(det)<1e-7;}
function getCombinations(arr,k){if(k<0||k>arr.length)return[];if(k===0)return[[]];if(k===arr.length)return[arr];if(k===1)return arr.map(item=>[item]);const cmb=[];function find(idx,curr){if(curr.length===k){cmb.push([...curr]);return;}if(idx>=arr.length)return;curr.push(arr[idx]);find(idx+1,curr);curr.pop();if(arr.length-(idx+1)>=k-curr.length)find(idx+1,curr);}find(0,[]);return cmb;}
function prepareConicPathToDraw() { if(highlightedStones.length<4){conicPath=null;return;}const [p1,p2,p3,p4]=highlightedStones;if(areThreePointsCollinear(p1,p2,p3)&&areThreePointsCollinear(p1,p2,p4)&&areThreePointsCollinear(p1,p3,p4)&&areThreePointsCollinear(p2,p3,p4)){let sS=[...highlightedStones].sort((a,b)=>(a.x!==b.x)?a.x-b.x:a.y-b.y);conicPath={type:'line',data:{p_start:sS[0],p_end:sS[3]}};}else{let cD=null;const c3=getCombinations(highlightedStones,3);for(const cb of c3){const[c1,c2,c3_]=cb;if(!areThreePointsCollinear(c1,c2,c3_)){cD=calculateCircleFrom3Points(c1,c2,c3_);if(cD){const fP=highlightedStones.find(p=>(p.x!==c1.x||p.y!==c1.y)&&(p.x!==c2.x||p.y!==c2.y)&&(p.x!==c3_.x||p.y!==c3_.y));if(fP){const d=dist(fP.x,fP.y,cD.center.x,cD.center.y);const tol=Math.max(0.01,cD.radius*0.02);if(Math.abs(d-cD.radius)<tol)break;}cD=null;}}}if(cD){conicPath={type:'circle',data:cD};}else{console.warn("Circle identification failed in prepareConicPathToDraw:",highlightedStones);let sS=[...highlightedStones].sort((a,b)=>(a.x-b.x)||(a.y-b.y));conicPath={type:'line',data:{p_start:sS[0],p_end:sS[3]}};}}}
function drawConicPath() { if(!conicPath||!conicPath.data)return;push();strokeWeight(3.5);noFill();let pC=color(255,80,50,210);if(conicPath.type==='circle'&&conicPath.data.center&&conicPath.data.radius>0){stroke(pC);ellipseMode(CENTER);ellipse(conicPath.data.center.x*CELL_SIZE,conicPath.data.center.y*CELL_SIZE,conicPath.data.radius*2*CELL_SIZE,conicPath.data.radius*2*CELL_SIZE);}else if(conicPath.type==='line'&&conicPath.data.p_start&&conicPath.data.p_end){stroke(pC);let p1px={x:conicPath.data.p_start.x*CELL_SIZE,y:conicPath.data.p_start.y*CELL_SIZE};let p2px={x:conicPath.data.p_end.x*CELL_SIZE,y:conicPath.data.p_end.y*CELL_SIZE};const minX=0;const maxX=GRID_DIVISIONS*CELL_SIZE;const minY=0;const maxY=GRID_DIVISIONS*CELL_SIZE;let ptsOB=[];if(Math.abs(p1px.x-p2px.x)<1e-6){ptsOB.push({x:p1px.x,y:minY});ptsOB.push({x:p1px.x,y:maxY});}else if(Math.abs(p1px.y-p2px.y)<1e-6){ptsOB.push({x:minX,y:p1px.y});ptsOB.push({x:maxX,y:p1px.y});}else{const sl=(p2px.y-p1px.y)/(p2px.x-p1px.x);const yI=p1px.y-sl*p1px.x;let yAMX=sl*minX+yI;if(yAMX>=minY&&yAMX<=maxY)ptsOB.push({x:minX,y:yAMX});let yAMaX=sl*maxX+yI;if(yAMaX>=minY&&yAMaX<=maxY)ptsOB.push({x:maxX,y:yAMaX});if(Math.abs(sl)>1e-6){let xAMY=(minY-yI)/sl;if(xAMY>=minX&&xAMY<=maxX)ptsOB.push({x:xAMY,y:minY});let xAMaY=(maxY-yI)/sl;if(xAMaY>=minX&&xAMaY<=maxX)ptsOB.push({x:xAMaY,y:maxY});}}let fP1=null,fP2=null,mDSq=-1;if(ptsOB.length>=2){for(let i=0;i<ptsOB.length;i++){for(let j=i+1;j<ptsOB.length;j++){let dSq=sq(ptsOB[i].x-ptsOB[j].x)+sq(ptsOB[i].y-ptsOB[j].y);if(dSq>mDSq){mDSq=dSq;fP1=ptsOB[i];fP2=ptsOB[j];}}}}if(fP1&&fP2)line(fP1.x,fP1.y,fP2.x,fP2.y);}pop();}
