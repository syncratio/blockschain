'use strict';
const canvas = document.querySelector('canvas');

const CUBE_WIDTH = 64;
const CUBE_HEIGHT = 74;

const ctx = canvas.getContext('2d');
ctx.font = 'bold 13px serif';

const assets = [
    'blue', 'darkBlue', 'orange', 'purple'
];

let game;
let cubeTextures;

class Game {
    constructor(context, canvas) {
        this.ctx = context;
        this.canvas = canvas;
        this.cubes = null;
        this.selectedCube = null;
        this.selectionIndex = null;
        this.matrix = null;
        this.releasedCube = null;
        this.combinations = null;
        this.loopID = null;

        this.generateField();
        this.drawField();
        this.listenToCanvasEvents();
    }

    loop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawField();
        this.loopID = requestAnimationFrame(this.loop.bind(this));
    }
    startLoop() {
        this.loopID = requestAnimationFrame(this.loop.bind(this));
    }

    stopLoop() {
        if (this.loopID) cancelAnimationFrame(this.loopID);
        this.loopID = null;
    }

    listenToCanvasEvents() {
        const mousemove = e => {
            this.updateSelectedCube(e.pageX - 28, e.pageY - 16);
        }
        const touch = e => {
            this.updateSelectedCube(e.touches[0].pageX - 28, e.touches[0].pageY - 16);
        }
        
        this.canvas.onmousedown = e => {
            this.retrieveCollidingCube(e.pageX, e.pageY);
        
            this.canvas.addEventListener('mousemove', mousemove);
        }

        this.canvas.ontouchstart = e => {
            this.retrieveCollidingCube(e.touches[0].pageX, e.touches[0].pageY);

            this.canvas.addEventListener('touchmove', touch);
        }
        this.canvas.ontouchend = e => {
            this.combineSelection(e.changedTouches[0].pageX, e.changedTouches[0].pageY);

            this.canvas.removeEventListener('touchmove', touch);
        }
        
        this.canvas.onmouseup = e => {
            game.combineSelection(e.pageX, e.pageY);
        
            canvas.removeEventListener('mousemove', mousemove);
        }
    }

    drawField() {
        if (this.cubes.length < 1) return;

        for (const c of this.cubes) {
            if (c === this.selectedCube) continue;
            c.draw(this.ctx);
        }
        if (this.selectedCube) this.selectedCube.draw(this.ctx);
    }

    generateField() {
        const cubes = [];
        const matrix = {};
        const distribution = this.generateDistribution();

        let startX = this.canvas.width / 2;
        let startY = this.canvas.height / 2;


        // Columns Y
        for (let i = 6; i > 0; i--) {
            
            // Rows X
            for (let j = 1; j <= i; j++) {
                const currentRowY = startY + j * CUBE_HEIGHT / 4;
                let currentRowX = startX - j * CUBE_WIDTH / 2;

                // Elements in a row Z
                for (let z = 0; z < j; z++) {
                    const dIndex = randomUpTo(distribution.length);
                    const {group, value} = distribution[dIndex];
                    const n = cubes.push(new Cube(currentRowX, currentRowY, 6 - i + j, value, group)) - 1;
                    currentRowX += CUBE_WIDTH;

                    // If not last row
                    if (j + 1 <= i) {
                        if (!matrix[n]) matrix[n] = {};

                        matrix[n].l = n + j;
                        matrix[n].r = n + j + 1;
                    }
                    // If there is an element below
                    if (matrix[n - rowSum(i + 1)]) {
                        matrix[n - rowSum(i + 1)].t = n;
                    }

                    distribution.splice(dIndex, 1);
                }
            }
            startY = startY - (CUBE_HEIGHT / 2);
        }
        this.cubes = cubes;
        this.matrix = matrix;
    }

    generateDistribution() {
        const groups = 4;
        const values = [32, 32, 16, 8, 8, 8, 4, 4, 4, 4, 2, 2, 2, 2];
        const elements = [];

        for (let i = 0; i < groups; i++) {
            shuffle(values);

            for (let j = 0; j < values.length; j++) {
                elements.push({
                    group: i,
                    value: values[j]
                });
            }
        }

        return shuffle(elements);
    }

    retrieveCollidingCube(x, y) {
        
        const [colliding, i] = this.collidingCubeIndexPair(x, y);

        if (i >= 0) {
            if (this.matrix[i]) {
                const {l, r, t} = this.matrix[i];
                if (t) return;
            }

            for (const key in this.matrix) {
                const {t} = this.matrix[key];
                if (t === i) {
                    this.releasedCube = {[key]: {t}};
                    console.log('Temporarily releasing ', t);
                    delete this.matrix[key].t;
                    break;
                }
            }

            this.selectedCube = colliding;
            this.selectionIndex = i;
        }
    }

    refreshReleasedCube() {
        if (this.releasedCube) {
            const [{t}] = Object.values(this.releasedCube);

            if (!this.cubes[t].disabled) {
                console.log('Unrelease:', this.releasedCube);
                Object.assign(this.matrix, this.releasedCube);
            }

            this.releasedCube = null;
        }
    }

    returnSelectedCube() {
        if (!this.selectedCube) return;
        
        this.selectedCube.x = this.selectedCube.startX;
        this.selectedCube.y = this.selectedCube.startY;

        this.selectedCube = null;
        this.selectionIndex = null;
    }

    updateSelectedCube(x, y) {
        if (!this.selectedCube) return;

        this.selectedCube.x = x;
        this.selectedCube.y = y;
    }

    collidingCubeIndexPair(x, y) {
        const cubes = [...this.cubes];
        if (this.selectionIndex) cubes.splice(this.selectionIndex, 1);
        
        const colliding = cubes.sort((a, b) => b.z - a.z).find(cube => cube.isSelected(x, y));
        const i = this.cubes.indexOf(colliding);

        return [colliding, i];
    }

    combineSelection(x, y) {
        if (!this.selectedCube) return;

        const [, i] = this.collidingCubeIndexPair(x, y);

        if (i < 0 || !this.canBeCombined(this.cubes[i], this.selectedCube)) {
            this.refreshReleasedCube();
            this.returnSelectedCube();
        } else {
            console.log(`Combining with cube #${i}, removing cube #${this.selectionIndex}`);

            for (const key in this.matrix) {
                const c = this.matrix[key];
                for (const side in c) if (c[side] === this.selectionIndex) delete c[side];
            }

            this.combinationEffect(this.cubes[i]);
            this.cubes[i].score *= 2;

            this.selectedCube.disabled = true;
            this.selectedCube = null;
            this.selectionIndex = null;
        }

        // this.drawField();
    }

    canBeCombined(c1, c2) {
        return c1.group === c2.group && c1.score === c2.score;
    }

    possibleMovesExist() {

        return false;
    }

    combinationEffect(targetCube) {
        let {x, y} = targetCube;
        x += randomUpTo(CUBE_WIDTH);
        const score = targetCube.score;
        let angle = 0;
        let id;

        const f = () => {
            this.ctx.translate(x, y);
            this.ctx.rotate(Math.PI / 180 * angle);
            
            this.ctx.fillText(score, 0, 0);
            
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            
            y--;
            angle++;

            id = requestAnimationFrame(f);
        }

        id = f();

        setTimeout(() => {
            cancelAnimationFrame(id);
        }, 2500);
    }
}

class Cube {
    constructor(x, y, z, score, group, image){
        this.x = x;
        this.y = y;
        this.z = z;
        this.startX = x;
        this.startY = y;

        this.image = image;
        this.group = group;
        this.score = score;
        this.hoverImage = null;
        this.disabled = false;
        this.isHovering = false;
        
        this.calcBounds();
    }

    calcBounds() {
        this.leftTop = new Point(this.x, this.y+18);
        this.top = new Point(this.x+32, this.y);
        this.rightTop = new Point(this.x+64, this.y+18);
        this.rightBottom = new Point(this.x+64, this.y+55);
        this.bottom = new Point(this.x+32, this.y+74);
        this.leftBottom = new Point(this.x, this.y+55);
    }


    isSelected(mx, my) {
        if(this.disabled) return false;

        let m, v1, v2, r = true;
        m = new Point(mx, my);

        v1 = new Vector(this.leftTop, this.top);
        v2 = new Vector(m, this.top);
        r &= v1.crossProduct(v2) <= 0;

        v1 = new Vector(this.top, this.rightTop);
        v2 = new Vector(m, this.rightTop);
        r &= v1.crossProduct(v2) <= 0;

        v1 = new Vector(this.rightTop, this.rightBottom);
        v2 = new Vector(m, this.rightBottom);
        r &= v1.crossProduct(v2) <= 0;

        v1 = new Vector(this.rightBottom, this.bottom);
        v2 = new Vector(m, this.bottom);
        r &= v1.crossProduct(v2) <= 0;

        v1 = new Vector(this.bottom, this.leftBottom);
        v2 = new Vector(m, this.leftBottom);
        r &= v1.crossProduct(v2) <= 0;

        v1 = new Vector(this.leftBottom, this.leftTop);
        v2 = new Vector(m, this.leftTop);
        r &= v1.crossProduct(v2) <= 0;
        
        return r;
    }

    draw(ctx, debugInfo = `${this.score}`) {
        if (this.disabled) return;

        ctx.drawImage(cubeTextures[this.group], this.x, this.y);
        if (debugInfo) ctx.fillText(debugInfo, this.x + 29, this.y + 22);
    }

    drawDebug(ctx) {
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.lineTo(this.left.x, this.left.y);
        ctx.lineTo(this.top.x, this.top.y);
        ctx.lineTo(this.right.x, this.right.y);
        ctx.lineTo(this.bottom.x, this.bottom.y);
        ctx.lineTo(this.left.x, this.left.y);
        ctx.closePath();
        ctx.stroke();
    }

    set coordinates({x, y}) {
        this.x = x;
        this.y = y;
    }

    get coordinates() {
        return {x: this.x, y: this.y}
    }
}

class Point {
    constructor(x, y){
        this.x = x;
        this.y = y;
    }
}

class Vector {
    constructor(point1, point2){
        this.x = point2.x - point1.x;
        this.y = point2.y - point1.y;
    }

    crossProduct({x, y}) {
        return this.x * y - this.y * x;
    }   
}

class AssetManager {
    constructor(assetList) {
        this.assets = assetList;
    }

    loadAssets(folder) {
        const promises = [];

        for (const assetName of this.assets) {
            promises.push(new Promise((res, rej) => {
                const asset = new Image();
                asset.src = `${folder}${assetName}.png`;

                asset.onload = () => {
                    res(asset);
                }
            }));
        }

        return Promise.all(promises);
    }
}

function rowSum(n) {
    return (n * (n + 1)) / 2;
}

function randomUpTo(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

function shuffle(a) {
    let j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

function getIndex(i = 0, j = 0, z = 0) {
    let pos = z;
    let lastFullRow = j - 1;
    if (lastFullRow > 0) {
        pos += rowSum(lastFullRow);
    }
    let currentFloor = 6 - i;

    if (currentFloor != 0) {
        let nRows = 7 - currentFloor;

        for (let floor = currentFloor; floor > 0; floor--, nRows++) {
            pos += rowSum(nRows);
        }
    }
    return pos;
}

const assetManager = new AssetManager(assets);

assetManager.loadAssets('./assets/').then(loadedAssets => {
    const [blue, darkBlue, orange, purple] = loadedAssets;

    cubeTextures = {
        0: blue,
        1: darkBlue,
        2: orange,
        3: purple
    };
    game = new Game(ctx, canvas);
    game.startLoop();
})