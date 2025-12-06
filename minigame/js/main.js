/**
 * 主游戏逻辑 - 微信小游戏版
 */
import SoundManager from './audio.js';
import { Warrior, Princess, Platform, Enemy, Trap, Bullet, Item } from './classes.js';

class Game {
  constructor() {
    // 获取画布和上下文
    this.canvas = wx.createCanvas();
    this.ctx = this.canvas.getContext('2d');
    
    // 获取屏幕尺寸
    const systemInfo = wx.getSystemInfoSync();
    this.width = systemInfo.windowWidth;
    this.height = systemInfo.windowHeight;
    
    // 设置画布尺寸
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    // 游戏状态
    this.gameState = 'menu'; // menu, playing, paused, victory, gameover
    
    // 游戏对象
    this.soundManager = new SoundManager();
    this.warrior = null;
    this.princess = null;
    this.platforms = [];
    this.enemies = [];
    this.traps = [];
    this.items = [];
    this.bullets = [];
    this.hearts = [];
    
    // 相机和关卡
    this.cameraX = 0;
    this.levelWidth = 12000;
    
    // 计时器
    this.gameTimer = 0;
    this.timerStarted = false;
    
    // 生命值
    this.health = 3;
    this.victoryTriggered = false;
    
    // 输入状态
    this.input = {
      left: false,
      right: false,
      jump: false,
      attack: false,
    };
    
    // 触摸状态
    this.touches = {};
    this.touchButtons = [];
    
    // 动画帧
    this.lastTime = 0;
    this.animationFrame = null;
    
    // 初始化触摸控制
    this.initTouchControls();
    
    // 开始游戏循环
    this.startGameLoop();
  }
  
  // 初始化触摸控制
  initTouchControls() {
    // 定义虚拟按钮区域
    const btnSize = 60;
    const padding = 20;
    const bottomY = this.height - btnSize - padding;
    
    this.touchButtons = [
      { id: 'left', x: padding, y: bottomY, width: btnSize, height: btnSize, label: '←' },
      { id: 'right', x: padding + btnSize + 15, y: bottomY, width: btnSize, height: btnSize, label: '→' },
      { id: 'jump', x: this.width - padding - btnSize * 2 - 15, y: bottomY, width: btnSize, height: btnSize, label: 'B', color: 'rgba(76, 175, 80, 0.5)' },
      { id: 'attack', x: this.width - padding - btnSize, y: bottomY, width: btnSize, height: btnSize, label: 'A', color: 'rgba(244, 67, 54, 0.5)' },
    ];
    
    // 开始按钮（菜单界面）
    this.startButton = {
      x: this.width / 2 - 100,
      y: this.height / 2 + 50,
      width: 200,
      height: 60,
    };
    
    // 触摸事件
    wx.onTouchStart((e) => this.handleTouchStart(e));
    wx.onTouchEnd((e) => this.handleTouchEnd(e));
    wx.onTouchMove((e) => this.handleTouchMove(e));
  }
  
  handleTouchStart(e) {
    const touches = e.touches;
    
    if (this.gameState === 'menu') {
      // 检测开始按钮点击
      for (const touch of touches) {
        if (this.isPointInRect(touch.clientX, touch.clientY, this.startButton)) {
          this.startGame();
          return;
        }
      }
    } else if (this.gameState === 'playing') {
      for (const touch of touches) {
        const touchId = touch.identifier;
        
        // 检测虚拟按钮
        for (const btn of this.touchButtons) {
          if (this.isPointInRect(touch.clientX, touch.clientY, btn)) {
            this.touches[touchId] = btn.id;
            this.input[btn.id] = true;
            break;
          }
        }
        
        // 检测暂停按钮
        if (this.isPointInRect(touch.clientX, touch.clientY, { x: this.width - 55, y: 20, width: 35, height: 35 })) {
          this.pauseGame();
        }
      }
    } else if (this.gameState === 'paused') {
      for (const touch of touches) {
        // 继续按钮
        if (this.isPointInRect(touch.clientX, touch.clientY, { x: this.width / 2 - 100, y: this.height / 2 - 30, width: 200, height: 50 })) {
          this.resumeGame();
        }
        // 重新开始按钮
        if (this.isPointInRect(touch.clientX, touch.clientY, { x: this.width / 2 - 100, y: this.height / 2 + 30, width: 200, height: 50 })) {
          this.restartGame();
        }
        // 返回菜单按钮
        if (this.isPointInRect(touch.clientX, touch.clientY, { x: this.width / 2 - 100, y: this.height / 2 + 90, width: 200, height: 50 })) {
          this.backToMenu();
        }
      }
    } else if (this.gameState === 'victory' || this.gameState === 'gameover') {
      for (const touch of touches) {
        // 重新开始按钮
        if (this.isPointInRect(touch.clientX, touch.clientY, { x: this.width / 2 - 100, y: this.height / 2 + 30, width: 200, height: 50 })) {
          this.restartGame();
        }
        // 返回菜单按钮
        if (this.isPointInRect(touch.clientX, touch.clientY, { x: this.width / 2 - 100, y: this.height / 2 + 90, width: 200, height: 50 })) {
          this.backToMenu();
        }
      }
    }
  }
  
  handleTouchEnd(e) {
    const changedTouches = e.changedTouches;
    
    for (const touch of changedTouches) {
      const touchId = touch.identifier;
      const btnId = this.touches[touchId];
      
      if (btnId) {
        this.input[btnId] = false;
        delete this.touches[touchId];
      }
    }
  }
  
  handleTouchMove(e) {
    // 可以添加触摸移动逻辑
  }
  
  isPointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }
  
  // 开始游戏
  startGame() {
    this.initLevel();
    this.gameState = 'playing';
    this.soundManager.playBackgroundMusic('audio/bg.mp3');
  }
  
  // 初始化关卡
  initLevel() {
    this.warrior = new Warrior(100, 300, this.soundManager);
    this.princess = new Princess(this.levelWidth - 300, this.height - 110);
    
    this.createPlatforms();
    this.createEnemies();
    this.createTraps();
    this.createItems();
    this.bullets = [];
    
    this.cameraX = 0;
    this.health = 3;
    this.victoryTriggered = false;
    
    this.gameTimer = 0;
    this.timerStarted = true;
  }
  
  createPlatforms() {
    this.platforms = [];
    const L = this.levelWidth;

    const area1End = L * 0.25;
    const area2Start = area1End;
    const area2End = L * 0.5;
    const area3Start = area2End;
    const area3End = L * 0.75;
    const area4Start = area3End;

    const area1Width = area1End;
    const area2Width = area2End - area2Start;
    const area3Width = area3End - area3Start;
    const area4Width = L - area4Start;

    // 地面
    this.platforms.push(new Platform(0, this.height - 50, L, 50, 'ground'));

    // 第一区域平台
    const sub1_1 = area1Width * 0.1;
    const sub1_2 = area1Width * 0.25;
    const sub1_3 = area1Width * 0.4;
    const sub1_4 = area1Width * 0.55;
    const sub1_5 = area1Width * 0.75;

    this.platforms.push(new Platform(sub1_1, this.height - 150, 200, 20, 'platform'));
    this.platforms.push(new Platform(sub1_2, this.height - 200, 150, 20, 'platform'));
    this.platforms.push(new Platform(sub1_3, this.height - 250, 180, 20, 'platform'));
    this.platforms.push(new Platform(sub1_4, this.height - 180, 160, 20, 'platform'));
    this.platforms.push(new Platform(sub1_5, this.height - 220, 200, 20, 'platform'));

    // 第二区域平台
    const platformCount2 = 10;
    const platformSpacing2 = area2Width / platformCount2;
    for (let i = 0; i < platformCount2; i++) {
      const x = area2Start + i * platformSpacing2;
      const y = this.height - 150 - Math.sin(i * 0.6) * 120;
      this.platforms.push(new Platform(x, y, 160, 20, 'platform'));
    }

    // 第三区域平台
    const sub3_1 = area3Start + area3Width * 0.05;
    const sub3_2 = area3Start + area3Width * 0.2;
    const sub3_3 = area3Start + area3Width * 0.35;
    const sub3_4 = area3Start + area3Width * 0.5;
    const sub3_5 = area3Start + area3Width * 0.65;
    const sub3_6 = area3Start + area3Width * 0.8;

    this.platforms.push(new Platform(sub3_1, this.height - 300, 200, 20, 'platform'));
    this.platforms.push(new Platform(sub3_2, this.height - 350, 180, 20, 'platform'));
    this.platforms.push(new Platform(sub3_3, this.height - 280, 200, 20, 'platform'));
    this.platforms.push(new Platform(sub3_4, this.height - 320, 160, 20, 'platform'));
    this.platforms.push(new Platform(sub3_5, this.height - 250, 200, 20, 'platform'));
    this.platforms.push(new Platform(sub3_6, this.height - 300, 180, 20, 'platform'));

    // 第四区域平台
    const platformCount4 = 8;
    const platformSpacing4 = area4Width / platformCount4;
    for (let i = 0; i < platformCount4; i++) {
      const x = area4Start + i * platformSpacing4;
      const y = this.height - 180 - Math.cos(i * 0.5) * 100;
      this.platforms.push(new Platform(x, y, 170, 20, 'platform'));
    }

    // 终点区域
    this.platforms.push(new Platform(L - L * 0.0625, this.height - 150, 300, 20, 'platform'));
    this.platforms.push(new Platform(L - L * 0.0375, this.height - 100, 300, 20, 'platform'));
  }
  
  createEnemies() {
    this.enemies = [];
    const L = this.levelWidth;

    const area1End = L * 0.25;
    const area2Start = area1End;
    const area2End = L * 0.5;
    const area3Start = area2End;
    const area3End = L * 0.75;
    const area4Start = area3End;

    const area1Width = area1End;
    const area2Width = area2End - area2Start;
    const area3Width = area3End - area3Start;
    const area4Width = L - area4Start;

    const patrolRange = 200;

    // 第一区域
    const e1_1 = area1Width * 0.25;
    const e1_2 = area1Width * 0.5;
    const e1_3 = area1Width * 0.65;
    this.enemies.push(new Enemy(e1_1, this.height - 100, 'patrol', e1_1 - patrolRange, e1_1 + patrolRange));
    this.enemies.push(new Enemy(e1_2, this.height - 100, 'patrol', e1_2 - patrolRange, e1_2 + patrolRange));
    this.enemies.push(new Enemy(e1_3, this.height - 280, 'fly', e1_3 - patrolRange * 2, e1_3 + patrolRange * 2));

    // 第二区域
    const e2_1 = area2Start + area2Width * 0.05;
    const e2_2 = area2Start + area2Width * 0.3;
    const e2_3 = area2Start + area2Width * 0.55;
    const e2_4 = area2Start + area2Width * 0.2;
    const e2_5 = area2Start + area2Width * 0.7;
    const e2_6 = area2Start + area2Width * 0.85;
    const e2_7 = area2Start + area2Width * 0.45;
    this.enemies.push(new Enemy(e2_1, this.height - 100, 'patrol', e2_1 - patrolRange, e2_1 + patrolRange));
    this.enemies.push(new Enemy(e2_2, this.height - 100, 'patrol', e2_2 - patrolRange, e2_2 + patrolRange));
    this.enemies.push(new Enemy(e2_3, this.height - 100, 'patrol', e2_3 - patrolRange, e2_3 + patrolRange));
    this.enemies.push(new Enemy(e2_4, this.height - 350, 'fly', e2_4 - patrolRange * 2.5, e2_4 + patrolRange * 2.5));
    this.enemies.push(new Enemy(e2_5, this.height - 320, 'fly', e2_5 - patrolRange * 2, e2_5 + patrolRange * 2));
    this.enemies.push(new Enemy(e2_6, this.height - 100, 'shooter', e2_6 - patrolRange * 0.5, e2_6 + patrolRange * 0.5));
    this.enemies.push(new Enemy(e2_7, this.height - 280, 'fly_shooter', e2_7 - patrolRange * 2, e2_7 + patrolRange * 2));

    // 第三区域
    const e3_1 = area3Start + area3Width * 0.1;
    const e3_2 = area3Start + area3Width * 0.4;
    const e3_3 = area3Start + area3Width * 0.25;
    const e3_4 = area3Start + area3Width * 0.6;
    const e3_5 = area3Start + area3Width * 0.75;
    const e3_6 = area3Start + area3Width * 0.5;
    this.enemies.push(new Enemy(e3_1, this.height - 100, 'patrol', e3_1 - patrolRange, e3_1 + patrolRange));
    this.enemies.push(new Enemy(e3_2, this.height - 100, 'patrol', e3_2 - patrolRange, e3_2 + patrolRange));
    this.enemies.push(new Enemy(e3_3, this.height - 400, 'fly', e3_3 - patrolRange * 2, e3_3 + patrolRange * 2));
    this.enemies.push(new Enemy(e3_4, this.height - 350, 'fly', e3_4 - patrolRange * 2, e3_4 + patrolRange * 2));
    this.enemies.push(new Enemy(e3_5, this.height - 100, 'shooter', e3_5 - patrolRange * 0.5, e3_5 + patrolRange * 0.5));
    this.enemies.push(new Enemy(e3_6, this.height - 320, 'fly_shooter', e3_6 - patrolRange * 2.5, e3_6 + patrolRange * 2.5));

    // 第四区域
    const e4_1 = area4Start + area4Width * 0.1;
    const e4_2 = area4Start + area4Width * 0.35;
    const e4_3 = area4Start + area4Width * 0.6;
    const e4_4 = area4Start + area4Width * 0.25;
    const e4_5 = area4Start + area4Width * 0.7;
    const e4_6 = area4Start + area4Width * 0.5;
    const e4_7 = area4Start + area4Width * 0.85;
    const e4_8 = area4Start + area4Width * 0.4;
    const e4_9 = area4Start + area4Width * 0.75;
    this.enemies.push(new Enemy(e4_1, this.height - 100, 'patrol', e4_1 - patrolRange, e4_1 + patrolRange));
    this.enemies.push(new Enemy(e4_2, this.height - 100, 'patrol', e4_2 - patrolRange, e4_2 + patrolRange));
    this.enemies.push(new Enemy(e4_3, this.height - 100, 'patrol', e4_3 - patrolRange, e4_3 + patrolRange));
    this.enemies.push(new Enemy(e4_4, this.height - 350, 'fly', e4_4 - patrolRange * 2.5, e4_4 + patrolRange * 2.5));
    this.enemies.push(new Enemy(e4_5, this.height - 380, 'fly', e4_5 - patrolRange * 2.5, e4_5 + patrolRange * 2.5));
    this.enemies.push(new Enemy(e4_6, this.height - 100, 'shooter', e4_6 - patrolRange * 0.5, e4_6 + patrolRange * 0.5));
    this.enemies.push(new Enemy(e4_7, this.height - 100, 'shooter', e4_7 - patrolRange * 0.5, e4_7 + patrolRange * 0.5));
    this.enemies.push(new Enemy(e4_8, this.height - 300, 'fly_shooter', e4_8 - patrolRange * 2, e4_8 + patrolRange * 2));
    this.enemies.push(new Enemy(e4_9, this.height - 350, 'fly_shooter', e4_9 - patrolRange * 2.5, e4_9 + patrolRange * 2.5));

    // 终点守卫
    const guardPos = L - L * 0.0875;
    this.enemies.push(new Enemy(guardPos, this.height - 100, 'patrol', guardPos - patrolRange, guardPos + patrolRange));
  }
  
  createTraps() {
    this.traps = [];
    const L = this.levelWidth;

    const area1End = L * 0.25;
    const area2Start = area1End;
    const area2End = L * 0.5;
    const area3Start = area2End;
    const area3End = L * 0.75;
    const area4Start = area3End;

    const area1Width = area1End;
    const area2Width = area2End - area2Start;
    const area3Width = area3End - area3Start;
    const area4Width = L - area4Start;

    const pitWidth = 180;
    const spikeWidth = 140;

    // 第一区域
    this.traps.push(new Trap(area1Width * 0.35, this.height - 50, pitWidth, 100, 'pit'));
    this.traps.push(new Trap(area1Width * 0.55, this.height - 70, spikeWidth, 20, 'spike'));

    // 第二区域
    this.traps.push(new Trap(area2Start + area2Width * 0.175, this.height - 70, spikeWidth, 20, 'spike'));
    this.traps.push(new Trap(area2Start + area2Width * 0.4, this.height - 50, pitWidth, 100, 'pit'));
    this.traps.push(new Trap(area2Start + area2Width * 0.625, this.height - 70, spikeWidth, 20, 'spike'));
    this.traps.push(new Trap(area2Start + area2Width * 0.825, this.height - 50, pitWidth, 100, 'pit'));

    // 第三区域
    this.traps.push(new Trap(area3Start + area3Width * 0.175, this.height - 70, spikeWidth, 20, 'spike'));
    this.traps.push(new Trap(area3Start + area3Width * 0.425, this.height - 50, pitWidth, 100, 'pit'));
    this.traps.push(new Trap(area3Start + area3Width * 0.675, this.height - 70, spikeWidth, 20, 'spike'));
    this.traps.push(new Trap(area3Start + area3Width * 0.875, this.height - 50, pitWidth, 100, 'pit'));

    // 第四区域
    this.traps.push(new Trap(area4Start + area4Width * 0.175, this.height - 70, spikeWidth, 20, 'spike'));
    this.traps.push(new Trap(area4Start + area4Width * 0.425, this.height - 50, pitWidth, 100, 'pit'));
    this.traps.push(new Trap(area4Start + area4Width * 0.65, this.height - 70, spikeWidth, 20, 'spike'));
    this.traps.push(new Trap(area4Start + area4Width * 0.8, this.height - 50, pitWidth, 100, 'pit'));
  }
  
  createItems() {
    this.items = [];
    const L = this.levelWidth;
    const area2Start = L * 0.25;
    const area2End = L * 0.5;
    const area2Width = area2End - area2Start;

    // 在第二区域末尾放置大宝剑
    const swordX = area2Start + area2Width * 0.9;
    this.items.push(new Item(swordX, this.height - 130, 'sword'));
  }
  
  // 检测道具拾取
  checkItemPickup() {
    this.items.forEach((item) => {
      if (item.collected) return;

      const collision =
        this.warrior.x < item.x + item.width &&
        this.warrior.x + this.warrior.width > item.x &&
        this.warrior.y < item.y + item.height + 10 &&
        this.warrior.y + this.warrior.height > item.y;

      if (collision) {
        item.collected = true;
        if (item.type === 'sword') {
          this.warrior.equipSword();
          this.soundManager.playSound(800, 0.2, 'sine');
        }
      }
    });
  }
  
  // 检测大宝剑是否击中敌人
  checkSwordHit(enemy) {
    const swordHitbox = this.warrior.getSwordHitbox();
    if (!swordHitbox) return false;
    
    const hitX = swordHitbox.x < enemy.x + enemy.width && swordHitbox.x + swordHitbox.width > enemy.x;
    const hitY = swordHitbox.y < enemy.y + enemy.height && swordHitbox.y + swordHitbox.height > enemy.y;
    return hitX && hitY;
  }
  
  // 检测子弹是否击中勇士
  checkBulletHit(bullet) {
    return (
      bullet.x < this.warrior.x + this.warrior.width &&
      bullet.x + bullet.width > this.warrior.x &&
      bullet.y < this.warrior.y + this.warrior.height &&
      bullet.y + bullet.height > this.warrior.y
    );
  }
  
  // 更新游戏逻辑
  update(deltaTime) {
    if (this.gameState === 'playing') {
      // 更新计时器
      if (this.timerStarted && !this.victoryTriggered) {
        this.gameTimer += deltaTime;
      }
      
      // 构建输入（胜利时禁止移动）
      const gameInput = {
        left: !this.victoryTriggered && this.input.left,
        right: !this.victoryTriggered && this.input.right,
        jump: this.input.jump,
        attack: this.input.attack,
      };
      
      // 更新勇士
      this.warrior.update(deltaTime, gameInput, this.platforms, this.traps, this.levelWidth);
      this.health = this.warrior.health;
      
      // 更新公主
      this.princess.updateAnimation(deltaTime);
      
      // 更新道具
      this.items.forEach((item) => item.update(deltaTime));
      this.checkItemPickup();
      
      // 更新敌人
      this.enemies.forEach((enemy) => enemy.update(deltaTime, this.warrior.x, this.warrior.y));
      
      // 处理射击怪物发射子弹
      this.enemies.forEach((enemy) => {
        if ((enemy.type === 'shooter' || enemy.type === 'fly_shooter') && !enemy.defeated) {
          const bullet = enemy.shoot();
          if (bullet) {
            this.bullets.push(bullet);
          }
        }
      });
      
      // 更新子弹
      this.bullets.forEach((bullet) => bullet.update(deltaTime));
      this.bullets = this.bullets.filter((bullet) => bullet.active && !bullet.isOutOfBounds(this.cameraX, this.width));
      
      // 子弹碰撞检测
      this.bullets.forEach((bullet) => {
        if (bullet.active && this.checkBulletHit(bullet)) {
          bullet.active = false;
          if (!this.warrior.isInvulnerable) {
            this.warrior.takeDamage();
            this.health = this.warrior.health;
          }
        }
      });
      
      // 敌人碰撞检测
      this.enemies.forEach((enemy) => {
        if (!enemy.defeated) {
          // 大宝剑攻击
          if (this.warrior.hasSword && this.warrior.isAttacking && this.checkSwordHit(enemy)) {
            enemy.defeat();
            this.soundManager.defeat();
            return;
          }
          
          // 身体碰撞
          if (this.warrior.checkCollision(enemy)) {
            if (this.warrior.vy > 0 && this.warrior.y < enemy.y) {
              enemy.defeat();
              this.warrior.vy = -8;
              this.soundManager.defeat();
            } else if (this.warrior.isAttacking && !this.warrior.hasSword) {
              enemy.defeat();
              this.soundManager.defeat();
            } else if (!this.warrior.isInvulnerable && !this.warrior.isAttacking) {
              this.warrior.takeDamage();
              this.health = this.warrior.health;
            }
          }
        }
      });
      
      // 更新相机
      this.updateCamera();
      
      // 检测胜利和游戏结束
      this.checkVictory();
      this.checkGameOver();
    }
    
    // 更新爱心粒子
    if (this.victoryTriggered) {
      this.hearts.forEach((heart) => {
        heart.x += heart.vx;
        heart.y += heart.vy;
        heart.rotation += heart.rotationSpeed;
      });
    }
  }
  
  updateCamera() {
    const targetX = this.warrior.x - this.width / 3;
    this.cameraX = Math.max(0, Math.min(targetX, this.levelWidth - this.width));
  }
  
  checkVictory() {
    const collision =
      this.warrior.x < this.princess.x + this.princess.width &&
      this.warrior.x + this.warrior.width > this.princess.x &&
      this.warrior.y < this.princess.y + this.princess.height &&
      this.warrior.y + this.warrior.height > this.princess.y;

    if (collision && !this.victoryTriggered) {
      this.victoryTriggered = true;
      
      // 清除输入
      this.input.left = false;
      this.input.right = false;
      this.input.jump = false;
      this.input.attack = false;
      
      this.createHeartParticles();
      this.soundManager.victory();
      
      setTimeout(() => {
        this.gameState = 'victory';
      }, 1000);
    }
  }
  
  checkGameOver() {
    if (this.warrior.health <= 0) {
      this.gameState = 'gameover';
    }
  }
  
  createHeartParticles() {
    this.hearts = [];
    const princessScreenX = this.princess.x - this.cameraX;
    const princessScreenY = this.princess.y;

    for (let i = 0; i < 20; i++) {
      this.hearts.push({
        x: princessScreenX + this.princess.width / 2 + (Math.random() - 0.5) * 50,
        y: princessScreenY + this.princess.height / 2,
        vx: (Math.random() - 0.5) * 2,
        vy: -2 - Math.random() * 3,
        size: 20 + Math.random() * 20,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }
  }
  
  // 暂停游戏
  pauseGame() {
    if (this.gameState === 'playing') {
      this.gameState = 'paused';
      this.soundManager.pauseBackgroundMusic();
    }
  }
  
  // 恢复游戏
  resumeGame() {
    if (this.gameState === 'paused') {
      this.gameState = 'playing';
      this.soundManager.resumeBackgroundMusic();
    }
  }
  
  // 重新开始
  restartGame() {
    this.soundManager.stopBackgroundMusic();
    this.gameState = 'playing';
    this.initLevel();
    this.soundManager.playBackgroundMusic('audio/bg.mp3');
  }
  
  // 返回菜单
  backToMenu() {
    this.soundManager.stopBackgroundMusic();
    this.gameState = 'menu';
  }
  
  // 渲染游戏
  render() {
    // 清屏
    this.ctx.fillStyle = '#87CEEB';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    if (this.gameState === 'menu') {
      this.renderMenu();
    } else {
      this.renderGame();
      this.renderUI();
      
      if (this.gameState === 'paused') {
        this.renderPauseMenu();
      } else if (this.gameState === 'victory') {
        this.renderVictoryScreen();
      } else if (this.gameState === 'gameover') {
        this.renderGameOverScreen();
      }
    }
  }
  
  renderMenu() {
    // 背景
    this.ctx.fillStyle = '#87CEEB';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // 标题
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('勇士救公主', this.width / 2, this.height / 2 - 50);
    
    // 副标题
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '24px Arial';
    this.ctx.fillText('钱程似锦', this.width / 2, this.height / 2);
    
    // 开始按钮
    this.ctx.fillStyle = 'rgba(255, 105, 180, 0.8)';
    this.roundRect(this.startButton.x, this.startButton.y, this.startButton.width, this.startButton.height, 30);
    this.ctx.fill();
    
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.fillText('开始游戏', this.width / 2, this.startButton.y + 38);
  }
  
  renderGame() {
    this.ctx.save();
    this.ctx.translate(-this.cameraX, 0);
    
    // 绘制云朵
    this.drawClouds();
    
    // 绘制平台
    this.platforms.forEach((platform) => platform.draw(this.ctx));
    
    // 绘制陷阱
    this.traps.forEach((trap) => trap.draw(this.ctx));
    
    // 绘制道具
    this.items.forEach((item) => item.draw(this.ctx));
    
    // 绘制敌人
    this.enemies.forEach((enemy) => enemy.draw(this.ctx));
    
    // 绘制子弹
    this.bullets.forEach((bullet) => bullet.draw(this.ctx));
    
    // 绘制公主
    this.princess.draw(this.ctx);
    
    // 绘制勇士
    this.warrior.draw(this.ctx);
    
    this.ctx.restore();
    
    // 绘制爱心粒子
    if (this.victoryTriggered) {
      this.renderHeartParticles();
    }
  }
  
  drawClouds() {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const clouds = [
      { x: 200, y: 100, w: 100, h: 50 },
      { x: 600, y: 150, w: 120, h: 60 },
      { x: 1200, y: 80, w: 90, h: 45 },
      { x: 1800, y: 120, w: 110, h: 55 },
      { x: 2500, y: 90, w: 100, h: 50 },
      { x: 3200, y: 140, w: 95, h: 48 },
    ];

    clouds.forEach((cloud) => {
      this.ctx.beginPath();
      this.ctx.arc(cloud.x, cloud.y, cloud.h / 2, Math.PI, 2 * Math.PI);
      this.ctx.arc(cloud.x + cloud.w / 2, cloud.y - cloud.h / 4, cloud.h * 0.6, Math.PI, 2 * Math.PI);
      this.ctx.arc(cloud.x + cloud.w, cloud.y, cloud.h / 2, Math.PI, 2 * Math.PI);
      this.ctx.closePath();
      this.ctx.fill();
    });
  }
  
  renderUI() {
    // 生命值
    for (let i = 0; i < 3; i++) {
      this.ctx.fillStyle = i < this.health ? '#f5576c' : 'rgba(245, 87, 108, 0.3)';
      this.ctx.font = '30px Arial';
      this.ctx.fillText('❤', 20 + i * 40, 45);
    }
    
    // 计时器
    const seconds = Math.floor(this.gameTimer / 1000);
    const milliseconds = Math.floor((this.gameTimer % 1000));
    const timeText = `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.roundRect(this.width / 2 - 60, 15, 120, 40, 15);
    this.ctx.fill();
    
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = 'bold 24px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(timeText, this.width / 2, 45);
    this.ctx.textAlign = 'left';
    
    // 暂停按钮
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.roundRect(this.width - 55, 20, 35, 35, 10);
    this.ctx.fill();
    
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('⏸', this.width - 37, 47);
    this.ctx.textAlign = 'left';
    
    // 虚拟按钮
    this.touchButtons.forEach((btn) => {
      this.ctx.fillStyle = btn.color || 'rgba(255, 255, 255, 0.3)';
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.lineWidth = 2;
      
      this.ctx.beginPath();
      this.ctx.arc(btn.x + btn.width / 2, btn.y + btn.height / 2, btn.width / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = 'bold 20px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2 + 7);
      this.ctx.textAlign = 'left';
    });
  }
  
  renderHeartParticles() {
    this.ctx.fillStyle = '#ff69b4';
    this.ctx.font = 'bold 30px Arial';
    this.hearts.forEach((heart) => {
      this.ctx.save();
      this.ctx.translate(heart.x, heart.y);
      this.ctx.rotate(heart.rotation);
      this.ctx.fillText('❤', 0, 0);
      this.ctx.restore();
    });
  }
  
  renderPauseMenu() {
    // 半透明背景
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // 标题
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 36px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('游戏暂停', this.width / 2, this.height / 2 - 80);
    
    // 按钮
    this.renderMenuButton('继续游戏', this.height / 2 - 30);
    this.renderMenuButton('重新开始', this.height / 2 + 30);
    this.renderMenuButton('返回菜单', this.height / 2 + 90);
    
    this.ctx.textAlign = 'left';
  }
  
  renderVictoryScreen() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = 'bold 36px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('🎉 恭喜通关!', this.width / 2, this.height / 2 - 80);
    
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '24px Arial';
    this.ctx.fillText('喜结良缘，钱程似锦！', this.width / 2, this.height / 2 - 30);
    
    this.renderMenuButton('再玩一次', this.height / 2 + 30);
    this.renderMenuButton('返回菜单', this.height / 2 + 90);
    
    this.ctx.textAlign = 'left';
  }
  
  renderGameOverScreen() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    this.ctx.fillStyle = '#FF6B6B';
    this.ctx.font = 'bold 32px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('燕子，没有你我怎么活啊~', this.width / 2, this.height / 2 - 50);
    
    this.renderMenuButton('重新开始', this.height / 2 + 30);
    this.renderMenuButton('返回菜单', this.height / 2 + 90);
    
    this.ctx.textAlign = 'left';
  }
  
  renderMenuButton(text, y) {
    this.ctx.fillStyle = 'rgba(255, 105, 180, 0.8)';
    this.roundRect(this.width / 2 - 100, y - 25, 200, 50, 25);
    this.ctx.fill();
    
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 18px Arial';
    this.ctx.fillText(text, this.width / 2, y + 6);
  }
  
  // 绘制圆角矩形
  roundRect(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }
  
  // 游戏循环
  startGameLoop() {
    const loop = (timestamp) => {
      const deltaTime = timestamp - this.lastTime;
      this.lastTime = timestamp;
      
      if (this.gameState !== 'paused') {
        this.update(deltaTime);
      }
      
      this.render();
      
      this.animationFrame = requestAnimationFrame(loop);
    };
    
    this.animationFrame = requestAnimationFrame(loop);
  }
}

// 导出游戏实例
export default Game;

