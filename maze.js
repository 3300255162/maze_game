class MazeGame {
    constructor() {
        this.canvas = document.getElementById('mazeCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.level = 1;
        this.isMobile = window.innerWidth <= 768;
        this.maxLevel = this.isMobile ? 10 : 30; // 移动端最多10关
        this.initLevel();
        this.bindControls();
        this.setupMobileControls();
        
        // 调整画布大小
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // 添加最高关卡记录
        this.highestLevel = parseInt(localStorage.getItem('highestLevel')) || 1;
        
        // 添加调试模式相关属性
        this.clickCount = 0;
        this.unlimitedView = false;
        this.debugMode = false;
        this.lastClickTime = 0;
        
        // 设置关卡目录和调试模式
        this.setupLevelMenu();
        this.setupDebugMode();
        this.hasTrap = false;
        this.rotationDegree = 0;
        
        // 添加性能优化
        this.lastDrawTime = 0;
        this.drawThrottle = 1000 / 30; // 限制30fps
        
        // 使用 requestAnimationFrame
        this.boundDraw = this.draw.bind(this);
    }

    initLevel() {
        // 根据设备类型和关卡调整难度
        if (this.isMobile) {
            // 移动端难度调整
            this.rows = 9 + Math.min(6, Math.floor(this.level)); // 最大到15行
            this.cols = 9 + Math.min(6, Math.floor(this.level)); // 最大到15列
            this.viewRadius = Math.max(2, 3 - Math.floor(this.level / 5)); // 视野范围更缓慢减少
        } else {
            // PC端难度调整
            this.rows = 11 + (this.level * 2);
            this.cols = 11 + (this.level * 2);
            this.viewRadius = Math.max(2, 4 - Math.floor(this.level / 3));
        }

        // 确保单元格大小不小于最小值
        const minCellSize = this.isMobile ? 25 : 15; // 增加移动端最小单元格大小
        this.cellSize = Math.max(
            minCellSize,
            Math.min(
                600 / this.cols,
                600 / this.rows
            )
        );
        
        // 初始化玩家位置
        this.playerX = 1;
        this.playerY = 1;
        
        // 初始化迷宫数组
        this.maze = Array(this.rows).fill().map(() => Array(this.cols).fill(1));
        this.generateMaze();

        // 更新画布大小以适应新的迷宫大小
        this.canvas.width = this.cols * this.cellSize;
        this.canvas.height = this.rows * this.cellSize;
        
        // 更新关卡显示
        this.updateLevelDisplay();
        
        // 从第3关开始添加陷阱
        this.hasTrap = this.level >= 3;
        this.rotationDegree = 0;
    }

    updateLevelDisplay() {
        const levelDisplay = document.getElementById('levelDisplay');
        if (levelDisplay) {
            levelDisplay.textContent = `关卡 ${this.level}`;
        }
    }

    draw() {
        const currentTime = performance.now();
        if (currentTime - this.lastDrawTime < this.drawThrottle) {
            requestAnimationFrame(this.boundDraw);
            return;
        }
        this.lastDrawTime = currentTime;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 计算可见区域
        const visibleCells = this.getVisibleCells();
        
        // 保存当前上下文状态
        this.ctx.save();
        
        // 应用旋转变换
        this.ctx.translate(this.canvas.width/2, this.canvas.height/2);
        this.ctx.rotate(this.rotationDegree * Math.PI / 180);
        this.ctx.translate(-this.canvas.width/2, -this.canvas.height/2);

        // 绘制迷宫
        for (let y = 0; y < this.maze.length; y++) {
            for (let x = 0; x < this.maze[y].length; x++) {
                const isVisible = visibleCells.some(cell => cell.x === x && cell.y === y);
                
                if (isVisible) {
                    if (this.maze[y][x] === 1) {
                        // 墙壁
                        this.ctx.fillStyle = '#000';
                        this.ctx.fillRect(
                            x * this.cellSize, 
                            y * this.cellSize, 
                            this.cellSize, 
                            this.cellSize
                        );
                    } else if (this.hasTrap && this.maze[y][x] === 2) {
                        // 水平镜像陷阱
                        this.ctx.fillStyle = '#444';
                        this.ctx.fillRect(
                            x * this.cellSize + this.cellSize/4, 
                            y * this.cellSize + this.cellSize/4, 
                            this.cellSize/2, 
                            this.cellSize/2
                        );
                    } else if (this.hasTrap && this.maze[y][x] === 3) {
                        // 垂直镜像陷阱
                        this.ctx.fillStyle = '#666';
                        this.ctx.fillRect(
                            x * this.cellSize + this.cellSize/4, 
                            y * this.cellSize + this.cellSize/4, 
                            this.cellSize/2, 
                            this.cellSize/2
                        );
                    } else {
                        // 路径
                        this.ctx.fillStyle = '#fff';
                        this.ctx.fillRect(
                            x * this.cellSize, 
                            y * this.cellSize, 
                            this.cellSize, 
                            this.cellSize
                        );
                    }
                } else {
                    // 迷雾
                    this.ctx.fillStyle = '#808080';
                    this.ctx.fillRect(
                        x * this.cellSize, 
                        y * this.cellSize, 
                        this.cellSize, 
                        this.cellSize
                    );
                }
            }
        }

        // 恢复上下文状态
        this.ctx.restore();
        
        // 重新保存状态用于绘制玩家和终点
        this.ctx.save();
        
        // 应用相同的旋转
        this.ctx.translate(this.canvas.width/2, this.canvas.height/2);
        this.ctx.rotate(this.rotationDegree * Math.PI / 180);
        this.ctx.translate(-this.canvas.width/2, -this.canvas.height/2);

        // 检查终点是否在可见范围内
        const endX = this.cols - 2;
        const endY = this.rows - 2;
        const isEndVisible = visibleCells.some(cell => cell.x === endX && cell.y === endY);

        // 只在可见范围内绘制终点
        if (isEndVisible) {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(
                endX * this.cellSize + this.cellSize/4,
                endY * this.cellSize + this.cellSize/4,
                this.cellSize/2,
                this.cellSize/2
            );
        }

        // 绘制玩家
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(
            this.playerX * this.cellSize + this.cellSize/2, 
            this.playerY * this.cellSize + this.cellSize/2, 
            this.cellSize/3, 
            0, 
            Math.PI * 2
        );
        this.ctx.fill();

        this.ctx.restore();

        // 检查是否到达终点
        if (this.playerX === this.cols-2 && this.playerY === this.rows-2) {
            setTimeout(() => {
                const nextLevel = this.level + 1;
                
                if (this.level >= this.maxLevel) {
                    alert(`恭喜你通关了所有 ${this.maxLevel} 关！`);
                    this.resetGame();
                } else {
                    alert(`恭喜通过第 ${this.level} 关！`);
                    this.level = nextLevel;
                    // 更新最高关卡记录
                    if (nextLevel > this.highestLevel) {
                        this.highestLevel = nextLevel;
                        localStorage.setItem('highestLevel', this.highestLevel);
                    }
                    this.initLevel();
                    // 更新关卡目录显示
                    this.setupLevelMenu();
                    this.draw();
                }
            }, 100);
        }
    }

    resetGame() {
        this.level = 1;
        this.initLevel();
        this.draw();
    }

    // 添加这个新方法来处理画布大小调整
    resizeCanvas() {
        // 防抖处理
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        this.resizeTimeout = setTimeout(() => {
            this.isMobile = window.innerWidth <= 768;
            const maxWidth = Math.min(window.innerWidth - 40, 600);
            const scale = maxWidth / this.canvas.width;
            this.canvas.style.width = `${this.canvas.width * scale}px`;
            this.canvas.style.height = `${this.canvas.height * scale}px`;
            this.draw();
        }, 100);
    }

    // 添加这个新方法来设置移动端控制
    setupMobileControls() {
        // 优化触摸事件
        let touchTimeout;
        const buttons = {
            'upBtn': { key: 'ArrowUp' },
            'downBtn': { key: 'ArrowDown' },
            'leftBtn': { key: 'ArrowLeft' },
            'rightBtn': { key: 'ArrowRight' }
        };

        for (const [btnId, config] of Object.entries(buttons)) {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (touchTimeout) clearTimeout(touchTimeout);
                    this.handleMove(config.key);
                }, { passive: false });
            }
        }

        // 优化滑动控制
        let lastTouchTime = 0;
        const touchThrottle = 100; // 限制触摸事件频率

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            lastTouchTime = Date.now();
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const currentTime = Date.now();
            if (currentTime - lastTouchTime < touchThrottle) return;
            lastTouchTime = currentTime;
            
            // ... 原有的触摸处理代码 ...
        }, { passive: false });
    }

    // 添加这个新方法来处理移动
    handleMove(key) {
        let newX = this.playerX;
        let newY = this.playerY;

        // 根据旋转角度调整移动方向
        const rotation = ((this.rotationDegree % 360) + 360) % 360;
        let adjustedKey = key;
        
        if (rotation === 90) {
            switch(key) {
                case 'ArrowUp': adjustedKey = 'ArrowLeft'; break;
                case 'ArrowRight': adjustedKey = 'ArrowUp'; break;
                case 'ArrowDown': adjustedKey = 'ArrowRight'; break;
                case 'ArrowLeft': adjustedKey = 'ArrowDown'; break;
            }
        } else if (rotation === 180) {
            switch(key) {
                case 'ArrowUp': adjustedKey = 'ArrowDown'; break;
                case 'ArrowRight': adjustedKey = 'ArrowLeft'; break;
                case 'ArrowDown': adjustedKey = 'ArrowUp'; break;
                case 'ArrowLeft': adjustedKey = 'ArrowRight'; break;
            }
        } else if (rotation === 270) {
            switch(key) {
                case 'ArrowUp': adjustedKey = 'ArrowRight'; break;
                case 'ArrowRight': adjustedKey = 'ArrowDown'; break;
                case 'ArrowDown': adjustedKey = 'ArrowLeft'; break;
                case 'ArrowLeft': adjustedKey = 'ArrowUp'; break;
            }
        }

        // 使用调整后的方向计算新位置
        switch(adjustedKey) {
            case 'ArrowUp': newY--; break;
            case 'ArrowDown': newY++; break;
            case 'ArrowLeft': newX--; break;
            case 'ArrowRight': newX++; break;
        }

        // 检查新位置是否有效
        if (newY >= 0 && newY < this.rows && newX >= 0 && newX < this.cols && 
            (this.maze[newY][newX] === 0 || this.maze[newY][newX] === 2)) {
            
            // 检查陷阱
            if (this.maze[newY][newX] === 2) {
                // 随机选择旋转角度（90度或180度）
                const rotateAmount = Math.random() < 0.5 ? 90 : 180;
                this.rotationDegree = (this.rotationDegree + rotateAmount) % 360;
                this.maze[newY][newX] = 0;
                alert(`触发旋转陷阱！迷宫旋转${rotateAmount}度！`);
            }
            
            this.playerX = newX;
            this.playerY = newY;
            this.draw();
        }
    }

    // 修改现有的 bindControls 方法
    bindControls() {
        document.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
                e.preventDefault();
                const key = e.key.startsWith('Arrow') ? e.key : {
                    'w': 'ArrowUp',
                    's': 'ArrowDown',
                    'a': 'ArrowLeft',
                    'd': 'ArrowRight'
                }[e.key];
                this.handleMove(key);
            }
        });
    }

    // 生成随机迷宫
    generateMaze() {
        // 初始化所有格子为墙
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.maze[y][x] = 1;
            }
        }

        // 设置起点和终点
        this.maze[1][1] = 0;
        this.maze[this.rows-2][this.cols-2] = 0;

        // 从起点开始生成迷宫
        this.carvePassages(1, 1);

        // 确保终点可达
        this.ensureEndPointAccessible();

        // 修改陷阱生成
        if (this.hasTrap) {
            const trapCount = Math.min(3, 1 + Math.floor((this.level - 3) / 2));
            this.placeTrap(2, trapCount); // 2 表示旋转陷阱
        }
    }

    ensureEndPointAccessible() {
        const endY = this.rows - 2;
        const endX = this.cols - 2;
        
        // 确保终点周围至少有一条路径
        let hasPath = false;
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        
        for (const [dy, dx] of directions) {
            const y = endY + dy;
            const x = endX + dx;
            if (y > 0 && y < this.rows-1 && x > 0 && x < this.cols-1) {
                if (this.maze[y][x] === 0) {
                    hasPath = true;
                    break;
                }
            }
        }

        // 如果终点被围住，强制打通一条路
        if (!hasPath) {
            // 优先尝试从左边或上边打通
            if (this.maze[endY][endX-1] === 1 && endX-1 > 0) {
                this.maze[endY][endX-1] = 0;
            } else if (this.maze[endY-1][endX] === 1 && endY-1 > 0) {
                this.maze[endY-1][endX] = 0;
            }
        }
    }

    carvePassages(x, y) {
        // 定义四个方向：上、右、下、左
        const directions = [
            [0, -2], [2, 0], [0, 2], [-2, 0]
        ];
        
        // 随机方向
        directions.sort(() => Math.random() - 0.5);

        // 尝试每个方向
        for (let [dx, dy] of directions) {
            const newX = x + dx;
            const newY = y + dy;

            // 检查是否在边界内且未访问过
            if (newX > 0 && newX < this.cols-1 && 
                newY > 0 && newY < this.rows-1 && 
                this.maze[newY][newX] === 1) {
                
                // 打通路径
                this.maze[newY][newX] = 0;
                // 打通中间的格子
                this.maze[y + dy/2][x + dx/2] = 0;
                
                // 递归继续生成
                this.carvePassages(newX, newY);
            }
        }
    }

    // 获取可见区域的单元格
    getVisibleCells() {
        if (this.debugMode) {
            const allCells = [];
            for (let y = 0; y < this.rows; y++) {
                for (let x = 0; x < this.cols; x++) {
                    allCells.push({x, y});
                }
            }
            return allCells;
        }

        const visibleCells = [];
        // 计算视野中心点
        let centerX = this.playerX;
        let centerY = this.playerY;

        for (let dy = -this.viewRadius; dy <= this.viewRadius; dy++) {
            for (let dx = -this.viewRadius; dx <= this.viewRadius; dx++) {
                const x = centerX + dx;
                const y = centerY + dy;
                
                if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance <= this.viewRadius) {
                        if (this.hasLineOfSight(centerX, centerY, x, y)) {
                            // 根据镜像状态调整可见格子的坐标
                            let visibleX = x;
                            let visibleY = y;
                            
                            if (this.isHorizontalMirrored) {
                                visibleX = this.cols - 1 - x;
                            }
                            if (this.isVerticalMirrored) {
                                visibleY = this.rows - 1 - y;
                            }
                            
                            visibleCells.push({x: visibleX, y: visibleY});
                        }
                    }
                }
            }
        }
        
        return visibleCells;
    }

    // 检查两点之间是否有视线
    hasLineOfSight(x1, y1, x2, y2) {
        // 如果在镜像状态下，需要转换检查的坐标
        let checkX1 = x1;
        let checkY1 = y1;
        let checkX2 = x2;
        let checkY2 = y2;
        
        if (this.isHorizontalMirrored) {
            checkX1 = this.cols - 1 - x1;
            checkX2 = this.cols - 1 - x2;
        }
        if (this.isVerticalMirrored) {
            checkY1 = this.rows - 1 - y1;
            checkY2 = this.rows - 1 - y2;
        }

        const dx = Math.abs(checkX2 - checkX1);
        const dy = Math.abs(checkY2 - checkY1);
        const sx = checkX1 < checkX2 ? 1 : -1;
        const sy = checkY1 < checkY2 ? 1 : -1;
        let err = dx - dy;

        let currentX = checkX1;
        let currentY = checkY1;

        while (true) {
            if (currentX === checkX2 && currentY === checkY2) {
                return true;
            }

            if (currentX !== checkX1 || currentY !== checkY1) {
                if (this.maze[currentY][currentX] === 1) {
                    return false;
                }
            }

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                currentX += sx;
            }
            if (e2 < dx) {
                err += dx;
                currentY += sy;
            }
        }
    }

    setupDebugMode() {
        const levelDisplay = document.getElementById('levelDisplay');
        if (levelDisplay) {
            levelDisplay.addEventListener('click', () => {
                const currentTime = new Date().getTime();
                
                if (currentTime - this.lastClickTime > 1000) {
                    this.clickCount = 0;
                }
                
                this.lastClickTime = currentTime;
                this.clickCount++;

                if (this.clickCount === 5) {
                    this.debugMode = !this.debugMode;
                    this.clickCount = 0;
                    
                    // 更新关卡目录以反映调试模式状态
                    this.setupLevelMenu();
                    
                    alert(this.debugMode ? '已开启调试模式（无限视野 + 关卡自由切换）' : '已关闭调试模式');
                    this.draw();
                }
            });
        }
    }

    setupLevelMenu() {
        const levelMenuBtn = document.getElementById('levelMenuBtn');
        const levelMenu = document.getElementById('levelMenu');
        const closeMenuBtn = document.getElementById('closeMenuBtn');
        const levelGrid = document.getElementById('levelGrid');

        levelGrid.innerHTML = '';
        for (let i = 1; i <= this.maxLevel; i++) {
            const btn = document.createElement('button');
            btn.className = `level-btn ${(!this.debugMode && i > this.highestLevel) ? 'locked' : ''} ${i === this.level ? 'current' : ''}`;
            btn.textContent = i;
            
            if (this.debugMode || i <= this.highestLevel) {
                btn.addEventListener('click', () => {
                    this.level = i;
                    this.initLevel();
                    this.draw();
                    levelMenu.style.display = 'none';
                });
            }
            
            levelGrid.appendChild(btn);
        }

        levelMenuBtn.addEventListener('click', () => {
            levelMenu.style.display = 'flex';
        });

        closeMenuBtn.addEventListener('click', () => {
            levelMenu.style.display = 'none';
        });

        levelMenu.addEventListener('click', (e) => {
            if (e.target === levelMenu) {
                levelMenu.style.display = 'none';
            }
        });
    }

    placeTrap(trapType, count) {
        for (let i = 0; i < count; i++) {
            let trapPlaced = false;
            while (!trapPlaced) {
                const x = Math.floor(Math.random() * (this.cols - 4)) + 2;
                const y = Math.floor(Math.random() * (this.rows - 4)) + 2;
                if (this.maze[y][x] === 0 && 
                    !(x === 1 && y === 1) && 
                    !(x === this.cols-2 && y === this.rows-2)) {
                    this.maze[y][x] = trapType;
                    trapPlaced = true;
                }
            }
        }
    }
}

// 启动游戏
window.onload = () => {
    new MazeGame();
}; 