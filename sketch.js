// --- Constants ---
const GRID_DIVISIONS = 10;
const CELL_SIZE = 35;
const DOT_RADIUS = CELL_SIZE * 0.42; // Target display size for the stone image

const CANVAS_WIDTH = GRID_DIVISIONS * CELL_SIZE + CELL_SIZE;
const CANVAS_HEIGHT = GRID_DIVISIONS * CELL_SIZE + CELL_SIZE;
const DRAW_OFFSET = CELL_SIZE / 2;

const ACTION_BUTTON_HEIGHT = CELL_SIZE * 1.25;
const ACTION_BUTTON_WIDTH = CELL_SIZE * 3.8;
const ACTION_BUTTON_PADDING = 12;

// --- Global Variables ---
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

let stoneDisplayImage; // Variable to hold the loaded stone image

// ------------------------------------
// p5.js Lifecycle Functions
// ------------------------------------
function preload() {
    console.log("Preload started...");
    // ★★★ IMPORTANT: Replace 'stone.png' with the EXACT filename of YOUR stone image.
    // Ensure this image file is in the SAME FOLDER as index.html and sketch.js.
    // Example: If your image is IMG_0161.PNG, use loadImage('IMG_0161.PNG');
    stoneDisplayImage = loadImage(
        'stone1.png', 
        () => {
            console.log("SUCCESS: Stone image ('stone1.png') loaded successfully!");
        }, 
        (errEvent) => {
            console.error("ERROR: Failed to load stone image ('stone1.png').");
            console.error("Ensure the file exists in the same folder as index.html and sketch.js.");
            console.error("Ensure you are running this via a LOCAL HTTP SERVER (e.g., VS Code Live Server), not by opening index.html directly as a file (file:///...).");
            console.error("Actual error event:", errEvent);
            alert("CRITICAL ERROR: Could not load the stone image ('stone1.png').\n\nPlease check:\n1. The filename is EXACTLY 'stone.png' (or update in sketch.js).\n2. The file 'stone.png' is in the SAME FOLDER as index.html.\n3. You are running this game using a LOCAL WEB SERVER (e.g., 'Open with Live Server' in VSCode).\n\nThe game board cannot be displayed correctly without the stone image.");
        }
    );
    console.log("Preload finished.");
}

function setup() {
    console.log("Setup started...");
    canvasInstance = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    let canvasContainer = select('#canvas-container');
    if (canvasContainer) {
        canvasInstance.parent('canvas-container');
        console.log("Canvas parented to #canvas-container.");
    } else {
        console.error("#canvas-container div not found in HTML! Canvas will be appended to body.");
    }

    textFont('Inter, Roboto, sans-serif');
    
    resetButton = select('#resetButton');
    if(resetButton) {
        resetButton.mousePressed(resetGame);
    } else {
        console.error("Reset button not found in HTML.");
    }

    inputPlayer1Name = select('#player1NameInput');
    inputPlayer2Name = select('#player2NameInput');
    if(inputPlayer1Name) inputPlayer1Name.input(updatePlayerNames); else console.error("Player 1 name input not found.");
    if(inputPlayer2Name) inputPlayer2Name.input(updatePlayerNames); else console.error("Player 2 name input not found.");

    challengeRuleCheckbox = select('#challengeRuleCheckbox');
    if(challengeRuleCheckbox) {
        challengeRuleCheckbox.changed(() => {
            challengeRuleActive = challengeRuleCheckbox.checked();
            resetGame();
        });
        challengeRuleActive = challengeRuleCheckbox.checked(); // Initialize from checkbox state
    } else {
        console.error("Challenge rule checkbox not found.");
    }

    // Define placement confirmation buttons (drawn on canvas)
    const buttonYPos = height - ACTION_BUTTON_HEIGHT - ACTION_BUTTON_PADDING;
    const totalPlacementButtonWidth = ACTION_BUTTON_WIDTH * 2 + ACTION_BUTTON_PADDING;
    const placementButtonStartX = (width - totalPlacementButtonWidth) / 2;
    placementOkButton = { x: placementButtonStartX, y: buttonYPos, w: ACTION_BUTTON_WIDTH, h: ACTION_BUTTON_HEIGHT, label: "Place" };
    placementCancelButton = { x: placementButtonStartX + ACTION_BUTTON_WIDTH + ACTION_BUTTON_PADDING, y: buttonYPos, w: ACTION_BUTTON_WIDTH, h: ACTION_BUTTON_HEIGHT, label: "Cancel" };

    // Get HTML Challenge Button
    challengeButtonContainerElement = select('#challengeButtonContainer');
    challengeButtonImgElement = select('#challengeButtonImg');
    if (challengeButtonImgElement) {
        challengeButtonImgElement.mousePressed(resolveChallenge);
    } else {
        console.error("Challenge button image element not found.");
    }

    textAlign(CENTER, CENTER);
    imageMode(CENTER); // Draw images from their center point
    
    updatePlayerNames(); // Initialize player names from input fields
    resetGame(); // Initialize game state
    console.log("Setup finished.");
}

function draw() {
    // console.log("Draw loop running, gameState:", gameState); // Uncomment for intense debugging
    background(238, 241, 245); 
    
    push(); // For board drawing context
    translate(DRAW_OFFSET, DRAW_OFFSET);
    drawGrid();
    if (gameOver && conicPath) drawConicPath();
    drawStones();
    if (gameState === 'CONFIRMING_SPOT' && previewStone) drawPreviewStone();
    pop(); // End board drawing context

    // Draw canvas buttons or show/hide HTML challenge button
    if (gameState === 'CONFIRMING_SPOT' && previewStone) {
        drawPlacementConfirmButtons();
        if (challengeButtonContainerElement) challengeButtonContainerElement.style('display', 'none');
    } else if (gameState === 'AWAITING_CHALLENGE' && challengeRuleActive) {
        if (challengeButtonContainerElement) challengeButtonContainerElement.style('display', 'flex');
    } else {
        if (challengeButtonContainerElement) challengeButtonContainerElement.style('display', 'none');
    }
    
    updateMessageDisplay();
}

function mousePressed() {
    if (gameOver) return;

    // Handle clicks on canvas-drawn placement confirmation buttons
    if (gameState === 'CONFIRMING_SPOT' && previewStone) {
        if (isButtonClicked(placementOkButton, mouseX, mouseY)) { 
            handleStonePlacementConfirmed(previewStone); 
            return; 
        }
        if (isButtonClicked(placementCancelButton, mouseX, mouseY)) { 
            previewStone = null; 
            gameState = 'SELECTING_SPOT'; 
            return; 
        }
    }
    // HTML Challenge button's click is handled by its own .mousePressed(resolveChallenge) in setup.

    // Handle board clicks for placing stones or skipping challenge
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
        // Click was outside canvas bounds, ignore unless it was a button
        return;
    }
    
    let inGridArea = mouseX >= DRAW_OFFSET && mouseX <= CANVAS_WIDTH - DRAW_OFFSET &&
                     mouseY >= DRAW_OFFSET && mouseY <= CANVAS_HEIGHT - DRAW_OFFSET;

    if (inGridArea) {
        let boardMouseX = mouseX - DRAW_OFFSET;
        let boardMouseY = mouseY - DRAW_OFFSET;
        let gridX = Math.round(boardMouseX / CELL_SIZE);
        let gridY = Math.round(boardMouseY / CELL_SIZE);

        if (gridX < 0 || gridX > GRID_DIVISIONS || gridY < 0 || gridY > GRID_DIVISIONS) return;

        if (gameState === 'SELECTING_SPOT' || gameState === 'AWAITING_CHALLENGE') {
            if (!isStoneAt(gridX, gridY)) {
                if (gameState === 'AWAITING_CHALLENGE') {
                    lastPlacedStoneForChallenge = null; // Player chose to place a stone, so challenge is skipped
                }
                previewStone = { x: gridX, y: gridY };
                gameState = 'CONFIRMING_SPOT';
            }
        } else if (gameState === 'CONFIRMING_SPOT') {
            // If already confirming, and click on another valid empty spot, change preview
            if (!isStoneAt(gridX, gridY)) {
                previewStone = { x: gridX, y: gridY };
            }
        }
    }
}

// ------------------------------------
// Button Drawing (Placement Buttons Only) & Helper
// ------------------------------------
function drawPlacementConfirmButtons() {
    fill(76, 175, 80, 235); noStroke();
    rect(placementOkButton.x, placementOkButton.y, placementOkButton.w, placementOkButton.h, 8);
    fill(255); textSize(ACTION_BUTTON_HEIGHT * 0.38); textFont('Inter'); textStyle(BOLD);
    text(placementOkButton.label, placementOkButton.x + placementOkButton.w / 2, placementOkButton.y + placementOkButton.h / 2);

    fill(244, 67, 54, 235); noStroke();
    rect(placementCancelButton.x, placementCancelButton.y, placementCancelButton.w, placementCancelButton.h, 8);
    fill(255); 
    text(placementCancelButton.label, placementCancelButton.x + placementCancelButton.w / 2, placementCancelButton.y + placementCancelButton.h / 2);
    textStyle(NORMAL);
}

function isButtonClicked(button, mx, my) { 
    if (!button) return false; // Safety check
    return mx >= button.x && mx <= button.x + button.w &&
           my >= button.y && my <= button.y + button.h;
}

// ------------------------------------
// Stone Placement and Challenge Logic
// ------------------------------------
function handleStonePlacementConfirmed(stoneToPlace) {
    placedStones.push({...stoneToPlace});
    lastPlacedStoneForChallenge = {...stoneToPlace};
    previewStone = null;

    if (challengeRuleActive) {
        currentPlayer = (currentPlayer === 1) ? 2 : 1;
        gameState = 'AWAITING_CHALLENGE';
    } else { // Auto-check mode
        let concyclicMadeByThisMove = false;
        if (placedStones.length >= 4) {
            const combinations = getCombinations(placedStones, 4);
            for (const combo of combinations) {
                let newStoneInCombo = combo.some(s => s.x === stoneToPlace.x && s.y === stoneToPlace.y);
                if (newStoneInCombo && arePointsConcyclicOrCollinear(combo[0], combo[1], combo[2], combo[3])) {
                    gameOver = true;
                    gameOverReason = 'auto_concyclic_lose';
                    highlightedStones = [...combo];
                    prepareConicPathToDraw();
                    currentPlayer = (currentPlayer === 1) ? 2 : 1; // Set winner (the other player)
                    concyclicMadeByThisMove = true;
                    break;
                }
            }
        }
        if (gameOver) { // From concyclic check
            gameState = 'GAME_OVER';
        } else {
            if (placedStones.length === (GRID_DIVISIONS + 1) * (GRID_DIVISIONS + 1)) {
                gameOver = true;
                gameOverReason = 'board_full_draw';
                gameState = 'GAME_OVER';
            } else {
                currentPlayer = (currentPlayer === 1) ? 2 : 1;
                gameState = 'SELECTING_SPOT';
            }
        }
    }
}

function resolveChallenge() {
    if (!lastPlacedStoneForChallenge) { 
        console.warn("Resolve challenge called without a target stone."); 
        gameState = 'SELECTING_SPOT'; 
        if (challengeButtonContainerElement) challengeButtonContainerElement.style('display', 'none');
        return; 
    }
    let challengeSuccessful = false;
    if (placedStones.length >= 4) {
        const combinations = getCombinations(placedStones, 4);
        for (const combo of combinations) {
            let lastStoneInCombo = combo.some(s => s.x === lastPlacedStoneForChallenge.x && s.y === lastPlacedStoneForChallenge.y);
            if (lastStoneInCombo && arePointsConcyclicOrCollinear(combo[0], combo[1], combo[2], combo[3])) {
                challengeSuccessful = true; 
                highlightedStones = [...combo]; 
                prepareConicPathToDraw(); 
                break;
            }
        }
    }
    gameOver = true; 
    gameState = 'GAME_OVER';
    if (challengeSuccessful) {
        gameOverReason = 'challenge_won';
        // Challenger (current currentPlayer) wins. currentPlayer already points to the challenger.
    } else {
        gameOverReason = 'challenge_failed';
        // Challenger loses, so the player who placed the stone (opponent of current) wins.
        currentPlayer = (currentPlayer === 1) ? 2 : 1; // Set winner to the one who placed the stone.
    }
    lastPlacedStoneForChallenge = null;
    if (challengeButtonContainerElement) challengeButtonContainerElement.style('display', 'none');
}

// ------------------------------------
// Message Display
// ------------------------------------
function updateMessageDisplay() {
    let titleHtml = ""; 
    let detailHtml = "";
    const p1Name = playerNames[1];
    const p2Name = playerNames[2];

    if (gameOver) {
        const winnerName = playerNames[currentPlayer]; // currentPlayer should now point to the winner
        const loserNum = (currentPlayer === 1) ? 2 : 1;
        const loserName = playerNames[loserNum];

        switch (gameOverReason) {
            case 'auto_concyclic_lose':
                titleHtml = `<strong style="font-size:1.6em;color:#e74c3c;display:block;margin-bottom:4px;">Concentric Set!</strong>`;
                detailHtml = `${loserName} formed a concentric set.<br><strong style="font-size:1.3em;color:#27ae60;">${winnerName} wins!</strong>`;
                break;
            case 'challenge_won':
                titleHtml = `<strong style="font-size:1.6em;color:#27ae60;display:block;margin-bottom:4px;">Challenge Successful!</strong>`;
                detailHtml = `${winnerName}'s challenge was correct.<br><strong style="font-size:1.3em;color:#27ae60;">${winnerName} wins!</strong>`;
                break;
            case 'challenge_failed':
                titleHtml = `<strong style="font-size:1.6em;color:#e74c3c;display:block;margin-bottom:4px;">Challenge Failed!</strong>`;
                // In case of failed challenge, currentPlayer is the one who placed the stone (the winner)
                // and loserName is the challenger.
                detailHtml = `${loserName}'s challenge was incorrect.<br><strong style="font-size:1.3em;color:#27ae60;">${winnerName} wins!</strong>`;
                break;
            case 'board_full_draw':
                titleHtml = `<strong style="font-size:1.6em;display:block;margin-bottom:4px;">Draw</strong>`;
                detailHtml = `<span style="font-size:1.1em;">All spaces are filled.</span>`;
                break;
            default:
                titleHtml = `<strong style="font-size:1.6em;display:block;margin-bottom:4px;">Game Over</strong>`;
                detailHtml = `<span style="font-size:1.1em;">Result undetermined.</span>`;
        }
    } else if (gameState === 'CONFIRMING_SPOT' && previewStone) {
        const targetPlayerName = playerNames[currentPlayer];
        const targetPlayerColor = currentPlayer === 1 ? '#e06c75' : '#61afef';
        detailHtml = `Place stone at: <strong style="font-weight:700;">(${previewStone.x}, ${previewStone.y})</strong><br><strong style="color:${targetPlayerColor};font-weight:700;">${targetPlayerName}</strong>, confirm placement?`;
    } else if (gameState === 'AWAITING_CHALLENGE' && challengeRuleActive) {
        const challengerName = playerNames[currentPlayer];
        const placerName = playerNames[(currentPlayer === 1) ? 2 : 1];
        const challengerColor = currentPlayer === 1 ? '#e06c75' : '#61afef';
        detailHtml = `${placerName} placed a stone.<br><strong style="color:${challengerColor};font-weight:700;">${challengerName}</strong>, challenge this move?<br><small>(Or click board to place your stone)</small>`;
    } else { // SELECTING_SPOT
        const currentPlayerColor = currentPlayer === 1 ? '#e06c75' : '#61afef';
        detailHtml = `Next turn: <strong style="color:${currentPlayerColor};font-weight:700;">${playerNames[currentPlayer]}</strong>.<br>Choose a spot to place your stone.`;
    }
    let msgArea = select('#messageArea');
    if (msgArea) msgArea.html(titleHtml + detailHtml);
}

// ------------------------------------
// Drawing Functions (Grid, Stones, Preview, Conic Path)
// ------------------------------------
function drawPreviewStone() {
    if (!previewStone || !stoneDisplayImage || stoneDisplayImage.width === 0) return;
    const stoneX = previewStone.x * CELL_SIZE;
    const stoneY = previewStone.y * CELL_SIZE;
    const stoneSize = DOT_RADIUS * 2;
    push();
    tint(255, 130); // Preview stone transparency
    image(stoneDisplayImage, stoneX, stoneY, stoneSize, stoneSize);
    pop();
}
function drawGrid() { 
    stroke(205,210,220); strokeWeight(1.5);
    for(let i=0;i<=GRID_DIVISIONS;i++){
        line(i*CELL_SIZE,0,i*CELL_SIZE,GRID_DIVISIONS*CELL_SIZE);
        line(0,i*CELL_SIZE,GRID_DIVISIONS*CELL_SIZE,i*CELL_SIZE);
    }
    if(GRID_DIVISIONS===10){
        let sP=[{x:3,y:3},{x:3,y:7},{x:7,y:3},{x:7,y:7},{x:5,y:5}];
        fill(180,185,195); noStroke();
        for(const p of sP) ellipse(p.x*CELL_SIZE,p.y*CELL_SIZE,DOT_RADIUS*0.25,DOT_RADIUS*0.25);
    }
}
function drawStones() {
    if (!stoneDisplayImage || stoneDisplayImage.width === 0) {
        // Fallback to drawing circles if image not loaded
        for (const stone of placedStones) {
            fill(50); noStroke();
            ellipse(stone.x * CELL_SIZE, stone.y * CELL_SIZE, DOT_RADIUS * 2, DOT_RADIUS * 2);
        }
        return;
    }

    for (const stone of placedStones) {
        const stoneX = stone.x * CELL_SIZE;
        const stoneY = stone.y * CELL_SIZE;
        const stoneSize = DOT_RADIUS * 2;

        // Simple shadow for the image
        push();
        translate(stoneX + 2, stoneY + 2);
        tint(0, 40); // Black, more transparent for shadow
        image(stoneDisplayImage, 0, 0, stoneSize, stoneSize);
        pop();

        // Draw the stone image itself (reset tint)
        push();
        noTint(); // Make sure image is drawn with its original colors
        image(stoneDisplayImage, stoneX, stoneY, stoneSize, stoneSize);
        pop();

        if (gameOver && highlightedStones.some(hs => hs.x === stone.x && hs.y === stone.y)) {
            stroke(255, 210, 0, 230); 
            strokeWeight(3.5);
            noFill();
            ellipse(stoneX, stoneY, stoneSize * 1.08, stoneSize * 1.08); 
            noStroke();
        }
    }
}
// ------------------------------------
// Game Logic Helper Functions (updatePlayerNames, isStoneAt, resetGame)
// ------------------------------------
function updatePlayerNames() { 
    if(inputPlayer1Name) playerNames[1]=inputPlayer1Name.value().trim()||"Player 1"; else playerNames[1]="Player 1";
    if(playerNames[1]==="")playerNames[1]="Player 1";
    if(inputPlayer2Name) playerNames[2]=inputPlayer2Name.value().trim()||"Player 2"; else playerNames[2]="Player 2";
    if(playerNames[2]==="")playerNames[2]="Player 2";

    if(!gameOver && gameState !=='CONFIRMING_SPOT' && gameState !=='AWAITING_CHALLENGE') {
        // Only update general turn messages if not in a confirmation/challenge state
        // (those states have specific messages handled by updateMessageDisplay directly)
        // updateMessageDisplay(); // This might be redundant as draw() calls it anyway
    }
}
function isStoneAt(x, y) { return placedStones.some(s => s.x === x && s.y === y); }
function resetGame() {
    console.log("Resetting game...");
    placedStones = []; currentPlayer = 1; gameOver = false; gameOverReason = null;
    highlightedStones = []; conicPath = null; previewStone = null;
    lastPlacedStoneForChallenge = null;
    if (challengeRuleCheckbox) challengeRuleActive = challengeRuleCheckbox.checked(); else challengeRuleActive = false;
    gameState = 'SELECTING_SPOT';
    
    updatePlayerNames(); // Ensure names are fresh before initial message
    
    const cpc = currentPlayer === 1 ? '#e06c75' : '#61afef';
    let initialMessage = `Next turn: <strong style="color:${cpc}; font-weight:700;">${playerNames[currentPlayer]}</strong>.<br>Choose a spot to place your stone.`;
    if (challengeRuleActive) {
        initialMessage += `<br><small style="font-size:0.85em; color:#555e68;">(Challenge Rule Enabled)</small>`;
    }
    let msgArea = select('#messageArea');
    if (msgArea) msgArea.html(initialMessage);
    
    if (challengeButtonContainerElement) challengeButtonContainerElement.style('display', 'none');
    console.log("Game reset. Initial gameState:", gameState);
    loop(); 
}

// ------------------------------------
// Geometric Calculation Functions (No changes from previous correct version)
// ------------------------------------
function areThreePointsCollinear(p1,p2,p3){const a2=p1.x*(p2.y-p3.y)+p2.x*(p3.y-p1.y)+p3.x*(p1.y-p2.y);return Math.abs(a2)<1e-7;}
function calculateCircleFrom3Points(p1,p2,p3){if(areThreePointsCollinear(p1,p2,p3))return null;const D=2*(p1.x*(p2.y-p3.y)+p2.x*(p3.y-p1.y)+p3.x*(p1.y-p2.y));if(Math.abs(D)<1e-9)return null;const p1s=p1.x*p1.x+p1.y*p1.y;const p2s=p2.x*p2.x+p2.y*p2.y;const p3s=p3.x*p3.x+p3.y*p3.y;const cX=(p1s*(p2.y-p3.y)+p2s*(p3.y-p1.y)+p3s*(p1.y-p2.y))/D;const cY=(p1s*(p3.x-p2.x)+p2s*(p1.x-p3.x)+p3s*(p2.x-p1.x))/D;const r=dist(p1.x,p1.y,cX,cY);if(r<1e-4)return null;return{center:{x:cX,y:cY},radius:r};}
function arePointsConcyclicOrCollinear(p1,p2,p3,p4){const ps=[p1,p2,p3,p4];const m=[];for(const p of ps){m.push([p.x*p.x+p.y*p.y,p.x,p.y,1]);}const d3=(a,b,c,d,e,f,g,h,i)=>a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);let det=0;det+=m[0][0]*d3(m[1][1],m[1][2],m[1][3],m[2][1],m[2][2],m[2][3],m[3][1],m[3][2],m[3][3]);det-=m[0][1]*d3(m[1][0],m[1][2],m[1][3],m[2][0],m[2][2],m[2][3],m[3][0],m[3][2],m[3][3]);det+=m[0][2]*d3(m[1][0],m[1][1],m[1][3],m[2][0],m[2][1],m[2][3],m[3][0],m[3][1],m[3][3]);det-=m[0][3]*d3(m[1][0],m[1][1],m[1][2],m[2][0],m[2][1],m[2][2],m[3][0],m[3][1],m[3][2]);return Math.abs(det)<1e-7;}
function getCombinations(arr,k){if(k<0||k>arr.length)return[];if(k===0)return[[]];if(k===arr.length)return[arr];if(k===1)return arr.map(item=>[item]);const cmb=[];function find(idx,curr){if(curr.length===k){cmb.push([...curr]);return;}if(idx>=arr.length)return;curr.push(arr[idx]);find(idx+1,curr);curr.pop();if(arr.length-(idx+1)>=k-curr.length)find(idx+1,curr);}find(0,[]);return cmb;}
function prepareConicPathToDraw() { if(highlightedStones.length<4){conicPath=null;return;}const [p1,p2,p3,p4]=highlightedStones;if(areThreePointsCollinear(p1,p2,p3)&&areThreePointsCollinear(p1,p2,p4)&&areThreePointsCollinear(p1,p3,p4)&&areThreePointsCollinear(p2,p3,p4)){let sS=[...highlightedStones].sort((a,b)=>(a.x!==b.x)?a.x-b.x:a.y-b.y);conicPath={type:'line',data:{p_start:sS[0],p_end:sS[3]}};}else{let cD=null;const c3=getCombinations(highlightedStones,3);for(const cb of c3){const[c1,c2,c3_]=cb;if(!areThreePointsCollinear(c1,c2,c3_)){cD=calculateCircleFrom3Points(c1,c2,c3_);if(cD){const fP=highlightedStones.find(p=>(p.x!==c1.x||p.y!==c1.y)&&(p.x!==c2.x||p.y!==c2.y)&&(p.x!==c3_.x||p.y!==c3_.y));if(fP){const d=dist(fP.x,fP.y,cD.center.x,cD.center.y);const tol=Math.max(0.01,cD.radius*0.02);if(Math.abs(d-cD.radius)<tol)break;}cD=null;}}}if(cD){conicPath={type:'circle',data:cD};}else{console.warn("Circle identification failed:",highlightedStones);let sS=[...highlightedStones].sort((a,b)=>(a.x-b.x)||(a.y-b.y));conicPath={type:'line',data:{p_start:sS[0],p_end:sS[3]}};}}}
function drawConicPath() { if(!conicPath||!conicPath.data)return;push();strokeWeight(3.5);noFill();let pC=color(255,80,50,210);if(conicPath.type==='circle'&&conicPath.data.center&&conicPath.data.radius>0){stroke(pC);ellipseMode(CENTER);ellipse(conicPath.data.center.x*CELL_SIZE,conicPath.data.center.y*CELL_SIZE,conicPath.data.radius*2*CELL_SIZE,conicPath.data.radius*2*CELL_SIZE);}else if(conicPath.type==='line'&&conicPath.data.p_start&&conicPath.data.p_end){stroke(pC);let p1px={x:conicPath.data.p_start.x*CELL_SIZE,y:conicPath.data.p_start.y*CELL_SIZE};let p2px={x:conicPath.data.p_end.x*CELL_SIZE,y:conicPath.data.p_end.y*CELL_SIZE};const minX=0;const maxX=GRID_DIVISIONS*CELL_SIZE;const minY=0;const maxY=GRID_DIVISIONS*CELL_SIZE;let ptsOB=[];if(Math.abs(p1px.x-p2px.x)<1e-6){ptsOB.push({x:p1px.x,y:minY});ptsOB.push({x:p1px.x,y:maxY});}else if(Math.abs(p1px.y-p2px.y)<1e-6){ptsOB.push({x:minX,y:p1px.y});ptsOB.push({x:maxX,y:p1px.y});}else{const sl=(p2px.y-p1px.y)/(p2px.x-p1px.x);const yI=p1px.y-sl*p1px.x;let yAMX=sl*minX+yI;if(yAMX>=minY&&yAMX<=maxY)ptsOB.push({x:minX,y:yAMX});let yAMaX=sl*maxX+yI;if(yAMaX>=minY&&yAMaX<=maxY)ptsOB.push({x:maxX,y:yAMaX});if(Math.abs(sl)>1e-6){let xAMY=(minY-yI)/sl;if(xAMY>=minX&&xAMY<=maxX)ptsOB.push({x:xAMY,y:minY});let xAMaY=(maxY-yI)/sl;if(xAMaY>=minX&&xAMaY<=maxX)ptsOB.push({x:xAMaY,y:maxY});}}let fP1=null,fP2=null,mDSq=-1;if(ptsOB.length>=2){for(let i=0;i<ptsOB.length;i++){for(let j=i+1;j<ptsOB.length;j++){let dSq=sq(ptsOB[i].x-ptsOB[j].x)+sq(ptsOB[i].y-ptsOB[j].y);if(dSq>mDSq){mDSq=dSq;fP1=ptsOB[i];fP2=ptsOB[j];}}}}if(fP1&&fP2)line(fP1.x,fP1.y,fP2.x,fP2.y);}pop();}
