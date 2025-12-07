/**
 * 主游戏逻辑 - 微信小游戏版
 */
import SoundManager from './audio.js';
import {Warrior, Princess, Platform, Enemy, Trap, Bullet, Item} from './classes.js';

class Game {
  constructor() {
    // 获取画布和上下文
    this.canvas = wx.createCanvas();
    this.ctx = this.canvas.getContext('2d');

    // 获取屏幕尺寸和设备像素比
    const systemInfo = wx.getSystemInfoSync();
    this.width = systemInfo.windowWidth;
    this.height = systemInfo.windowHeight;
    this.pixelRatio = systemInfo.pixelRatio || 2; // 设备像素比，用于高清渲染

    // 设置画布实际像素尺寸（乘以像素比以提高清晰度）
    this.canvas.width = this.width * this.pixelRatio;
    this.canvas.height = this.height * this.pixelRatio;

    // 缩放上下文以匹配逻辑尺寸
    this.ctx.scale(this.pixelRatio, this.pixelRatio);

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
    this.levelWidth = 24000;

    // 得分系统
    this.score = 0;
    this.maxReachedX = 0; // 追踪最远到达的X坐标
    this.bonusScore = 0; // 额外奖励分数（击杀、道具等）

    // 生命值
    this.health = 3;
    this.victoryTriggered = false;
    this.gameOverTriggered = false;

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
    this.buttonRipples = []; // 按钮水纹效果
    this.pressedButtons = {}; // 按压状态

    // 动画帧
    this.lastTime = 0;
    this.animationFrame = null;

    // 加载头像图片
    this.warriorAvatar = wx.createImage();
    this.warriorAvatar.src = 'images/warrior.jpg';
    this.princessAvatar = wx.createImage();
    this.princessAvatar.src = 'images/princess.jpg';

    // 头像悬浮动画时间
    this.avatarFloatTime = 0;

    // 菜单云朵动画偏移
    this.menuCloudOffset = 0;

    // 初始化触摸控制
    this.initTouchControls();

    // 播放主菜单背景音乐
    this.soundManager.playBackgroundMusic('audio/opening_music.mp3');

    // 开始游戏循环
    this.startGameLoop();
  }

  // 初始化触摸控制
  initTouchControls() {
    // 定义虚拟按钮区域（增大尺寸，上移位置）
    const btnSize = 75; // 按钮尺寸从 60 增大到 75
    const padding = 25;
    const bottomOffset = 50; // 距离底部的额外偏移，使按钮上移
    const bottomY = this.height - btnSize - padding - bottomOffset;

    this.touchButtons = [
      {id: 'left', x: padding, y: bottomY, width: btnSize, height: btnSize, label: '←'},
      {id: 'right', x: padding + btnSize + 20, y: bottomY, width: btnSize, height: btnSize, label: '→'},
      {
        id: 'attack',
        x: this.width - padding - btnSize * 2 - 20,
        y: bottomY,
        width: btnSize,
        height: btnSize,
        label: 'A',
        color: 'rgba(244, 67, 54, 0.5)',
      },
      {
        id: 'jump',
        x: this.width - padding - btnSize,
        y: bottomY,
        width: btnSize,
        height: btnSize,
        label: 'B',
        color: 'rgba(76, 175, 80, 0.5)',
      },
    ];

    // 菜单按钮（三个按钮横向排列，适配横屏）
    const menuBtnWidth = Math.min(180, (this.width - 80) / 3);
    const menuBtnHeight = Math.min(50, this.height / 5);
    const menuBtnSpacing = 20;
    const totalWidth = menuBtnWidth * 3 + menuBtnSpacing * 2;
    const startX = (this.width - totalWidth) / 2;

    this.menuButtons = {
      start: {
        x: startX,
        y: this.height / 2 + 20,
        width: menuBtnWidth,
        height: menuBtnHeight,
        label: '开始游戏',
        color: 'rgba(255, 105, 180, 0.8)',
      },
      help: {
        x: startX + menuBtnWidth + menuBtnSpacing,
        y: this.height / 2 + 20,
        width: menuBtnWidth,
        height: menuBtnHeight,
        label: '游戏说明',
        color: 'rgba(64, 224, 208, 0.8)',
      },
      sound: {
        x: startX + (menuBtnWidth + menuBtnSpacing) * 2,
        y: this.height / 2 + 20,
        width: menuBtnWidth,
        height: menuBtnHeight,
        label: '音效: 开',
        color: 'rgba(80, 200, 120, 0.8)',
      },
    };

    // 游戏说明弹窗状态
    this.showHelp = false;
    this.helpCloseButton = {x: 0, y: 0, width: 30, height: 30};

    // 触摸事件
    wx.onTouchStart((e) => this.handleTouchStart(e));
    wx.onTouchEnd((e) => this.handleTouchEnd(e));
    wx.onTouchMove((e) => this.handleTouchMove(e));
  }

  handleTouchStart(e) {
    const touches = e.touches;

    if (this.gameState === 'menu') {
      for (const touch of touches) {
        // 如果显示帮助弹窗，只有点击关闭按钮才关闭
        if (this.showHelp) {
          if (this.isPointInRect(touch.clientX, touch.clientY, this.helpCloseButton)) {
            this.showHelp = false;
          }
          return;
        }

        // 检测开始游戏按钮
        if (this.isPointInRect(touch.clientX, touch.clientY, this.menuButtons.start)) {
          this.startGame();
          return;
        }

        // 检测游戏说明按钮
        if (this.isPointInRect(touch.clientX, touch.clientY, this.menuButtons.help)) {
          this.showHelp = true;
          return;
        }

        // 检测音效按钮
        if (this.isPointInRect(touch.clientX, touch.clientY, this.menuButtons.sound)) {
          this.soundManager.enabled = !this.soundManager.enabled;
          this.menuButtons.sound.label = this.soundManager.enabled ? '音效: 开' : '音效: 关';
          this.menuButtons.sound.color = this.soundManager.enabled
            ? 'rgba(80, 200, 120, 0.8)'
            : 'rgba(150, 150, 150, 0.8)';

          // 同步控制背景音乐
          if (this.soundManager.enabled) {
            this.soundManager.resumeBackgroundMusic();
          } else {
            this.soundManager.pauseBackgroundMusic();
          }
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
            // 记录按压状态
            this.pressedButtons[btn.id] = true;
            // 添加水纹效果
            this.buttonRipples.push({
              x: btn.x + btn.width / 2,
              y: btn.y + btn.height / 2,
              radius: 0,
              maxRadius: btn.width * 0.8,
              alpha: 0.6,
              btnId: btn.id,
            });
            break;
          }
        }

        // 检测暂停按钮（血条左侧）
        if (this.isPointInRect(touch.clientX, touch.clientY, {x: 25, y: 18, width: 28, height: 28})) {
          this.pauseGame();
        }
      }
    } else if (this.gameState === 'paused') {
      // 横屏适配的按钮位置计算
      const centerY = this.height / 2;
      const btnSpacing = Math.min(45, this.height / 6);
      const btnWidth = 160;
      const btnHeight = 40;
      const btnX = this.width / 2 - btnWidth / 2;

      for (const touch of touches) {
        // 继续按钮
        if (
          this.isPointInRect(touch.clientX, touch.clientY, {
            x: btnX,
            y: centerY - btnSpacing * 0.3 - btnHeight / 2,
            width: btnWidth,
            height: btnHeight,
          })
        ) {
          this.resumeGame();
        }
        // 重新开始按钮
        if (
          this.isPointInRect(touch.clientX, touch.clientY, {
            x: btnX,
            y: centerY + btnSpacing * 0.7 - btnHeight / 2,
            width: btnWidth,
            height: btnHeight,
          })
        ) {
          this.restartGame();
        }
        // 返回菜单按钮
        if (
          this.isPointInRect(touch.clientX, touch.clientY, {
            x: btnX,
            y: centerY + btnSpacing * 1.7 - btnHeight / 2,
            width: btnWidth,
            height: btnHeight,
          })
        ) {
          this.backToMenu();
        }
      }
    } else if (this.gameState === 'victory' || this.gameState === 'gameover') {
      // 横屏适配的按钮位置计算
      const centerY = this.height / 2;
      const btnSpacing = Math.min(45, this.height / 6);
      const btnWidth = 160;
      const btnHeight = 40;
      const btnX = this.width / 2 - btnWidth / 2;

      // 胜利界面的按钮位置
      const btn1Y = this.gameState === 'victory' ? centerY + btnSpacing * 0.5 : centerY + btnSpacing * 0.3;
      const btn2Y = this.gameState === 'victory' ? centerY + btnSpacing * 1.5 : centerY + btnSpacing * 1.3;

      for (const touch of touches) {
        // 重新开始/再玩一次按钮
        if (
          this.isPointInRect(touch.clientX, touch.clientY, {
            x: btnX,
            y: btn1Y - btnHeight / 2,
            width: btnWidth,
            height: btnHeight,
          })
        ) {
          this.restartGame();
        }
        // 返回菜单按钮
        if (
          this.isPointInRect(touch.clientX, touch.clientY, {
            x: btnX,
            y: btn2Y - btnHeight / 2,
            width: btnWidth,
            height: btnHeight,
          })
        ) {
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
        // 取消按压状态
        this.pressedButtons[btnId] = false;
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
    // 勇士初始位置：站在地面上（地面在 height - 50，勇士高度 60）
    const warriorStartY = this.height - 50 - 60;
    this.warrior = new Warrior(100, warriorStartY, this.soundManager);
    // 设置伤害回调（任何伤害都扣分）
    this.warrior.onDamageCallback = () => {
      this.deductScore(5000);
    };
    this.princess = new Princess(this.levelWidth - 300, this.height - 110);

    this.createPlatforms();
    this.createEnemies();
    this.createTraps();
    this.createItems();
    this.bullets = [];

    this.cameraX = 0;
    this.health = 3;
    this.victoryTriggered = false;
    this.gameOverTriggered = false;

    this.score = 0;
    this.maxReachedX = 0;
    this.bonusScore = 0;
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

    // ========== 第一区域：入门区（6只怪：5巡逻 + 1飞行）==========
    const e1_positions = [0.12, 0.25, 0.38, 0.52, 0.68, 0.82];
    this.enemies.push(
      new Enemy(
        area1Width * e1_positions[0],
        this.height - 100,
        'patrol',
        area1Width * e1_positions[0] - patrolRange,
        area1Width * e1_positions[0] + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area1Width * e1_positions[1],
        this.height - 100,
        'patrol',
        area1Width * e1_positions[1] - patrolRange,
        area1Width * e1_positions[1] + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area1Width * e1_positions[2],
        this.height - 100,
        'patrol',
        area1Width * e1_positions[2] - patrolRange,
        area1Width * e1_positions[2] + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area1Width * e1_positions[3],
        this.height - 280,
        'fly',
        area1Width * e1_positions[3] - patrolRange * 2,
        area1Width * e1_positions[3] + patrolRange * 2
      )
    );
    this.enemies.push(
      new Enemy(
        area1Width * e1_positions[4],
        this.height - 100,
        'patrol',
        area1Width * e1_positions[4] - patrolRange,
        area1Width * e1_positions[4] + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area1Width * e1_positions[5],
        this.height - 100,
        'patrol',
        area1Width * e1_positions[5] - patrolRange,
        area1Width * e1_positions[5] + patrolRange
      )
    );

    // ========== 第二区域：进阶区（10只怪：4巡逻 + 3飞行 + 2射手 + 1飞行射手）==========
    // 巡逻怪
    this.enemies.push(
      new Enemy(
        area2Start + area2Width * 0.05,
        this.height - 100,
        'patrol',
        area2Start + area2Width * 0.05 - patrolRange,
        area2Start + area2Width * 0.05 + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area2Start + area2Width * 0.22,
        this.height - 100,
        'patrol',
        area2Start + area2Width * 0.22 - patrolRange,
        area2Start + area2Width * 0.22 + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area2Start + area2Width * 0.48,
        this.height - 100,
        'patrol',
        area2Start + area2Width * 0.48 - patrolRange,
        area2Start + area2Width * 0.48 + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area2Start + area2Width * 0.72,
        this.height - 100,
        'patrol',
        area2Start + area2Width * 0.72 - patrolRange,
        area2Start + area2Width * 0.72 + patrolRange
      )
    );
    // 飞行怪
    this.enemies.push(
      new Enemy(
        area2Start + area2Width * 0.15,
        this.height - 350,
        'fly',
        area2Start + area2Width * 0.15 - patrolRange * 2.5,
        area2Start + area2Width * 0.15 + patrolRange * 2.5
      )
    );
    this.enemies.push(
      new Enemy(
        area2Start + area2Width * 0.38,
        this.height - 320,
        'fly',
        area2Start + area2Width * 0.38 - patrolRange * 2,
        area2Start + area2Width * 0.38 + patrolRange * 2
      )
    );
    this.enemies.push(
      new Enemy(
        area2Start + area2Width * 0.62,
        this.height - 280,
        'fly',
        area2Start + area2Width * 0.62 - patrolRange * 2,
        area2Start + area2Width * 0.62 + patrolRange * 2
      )
    );
    // 射手
    this.enemies.push(
      new Enemy(
        area2Start + area2Width * 0.55,
        this.height - 100,
        'shooter',
        area2Start + area2Width * 0.55 - patrolRange * 0.5,
        area2Start + area2Width * 0.55 + patrolRange * 0.5
      )
    );
    this.enemies.push(
      new Enemy(
        area2Start + area2Width * 0.88,
        this.height - 100,
        'shooter',
        area2Start + area2Width * 0.88 - patrolRange * 0.5,
        area2Start + area2Width * 0.88 + patrolRange * 0.5
      )
    );
    // 飞行射手
    this.enemies.push(
      new Enemy(
        area2Start + area2Width * 0.78,
        this.height - 300,
        'fly_shooter',
        area2Start + area2Width * 0.78 - patrolRange * 2,
        area2Start + area2Width * 0.78 + patrolRange * 2
      )
    );

    // ========== 第三区域：挑战区（12只怪：4巡逻 + 3飞行 + 3射手 + 2飞行射手）==========
    // 巡逻怪
    this.enemies.push(
      new Enemy(
        area3Start + area3Width * 0.08,
        this.height - 100,
        'patrol',
        area3Start + area3Width * 0.08 - patrolRange,
        area3Start + area3Width * 0.08 + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area3Start + area3Width * 0.28,
        this.height - 100,
        'patrol',
        area3Start + area3Width * 0.28 - patrolRange,
        area3Start + area3Width * 0.28 + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area3Start + area3Width * 0.52,
        this.height - 100,
        'patrol',
        area3Start + area3Width * 0.52 - patrolRange,
        area3Start + area3Width * 0.52 + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area3Start + area3Width * 0.75,
        this.height - 100,
        'patrol',
        area3Start + area3Width * 0.75 - patrolRange,
        area3Start + area3Width * 0.75 + patrolRange
      )
    );
    // 飞行怪
    this.enemies.push(
      new Enemy(
        area3Start + area3Width * 0.18,
        this.height - 380,
        'fly',
        area3Start + area3Width * 0.18 - patrolRange * 2,
        area3Start + area3Width * 0.18 + patrolRange * 2
      )
    );
    this.enemies.push(
      new Enemy(
        area3Start + area3Width * 0.42,
        this.height - 350,
        'fly',
        area3Start + area3Width * 0.42 - patrolRange * 2,
        area3Start + area3Width * 0.42 + patrolRange * 2
      )
    );
    this.enemies.push(
      new Enemy(
        area3Start + area3Width * 0.68,
        this.height - 320,
        'fly',
        area3Start + area3Width * 0.68 - patrolRange * 2,
        area3Start + area3Width * 0.68 + patrolRange * 2
      )
    );
    // 射手
    this.enemies.push(
      new Enemy(
        area3Start + area3Width * 0.35,
        this.height - 100,
        'shooter',
        area3Start + area3Width * 0.35 - patrolRange * 0.5,
        area3Start + area3Width * 0.35 + patrolRange * 0.5
      )
    );
    this.enemies.push(
      new Enemy(
        area3Start + area3Width * 0.62,
        this.height - 100,
        'shooter',
        area3Start + area3Width * 0.62 - patrolRange * 0.5,
        area3Start + area3Width * 0.62 + patrolRange * 0.5
      )
    );
    this.enemies.push(
      new Enemy(
        area3Start + area3Width * 0.85,
        this.height - 100,
        'shooter',
        area3Start + area3Width * 0.85 - patrolRange * 0.5,
        area3Start + area3Width * 0.85 + patrolRange * 0.5
      )
    );
    // 飞行射手
    this.enemies.push(
      new Enemy(
        area3Start + area3Width * 0.25,
        this.height - 300,
        'fly_shooter',
        area3Start + area3Width * 0.25 - patrolRange * 2.5,
        area3Start + area3Width * 0.25 + patrolRange * 2.5
      )
    );
    this.enemies.push(
      new Enemy(
        area3Start + area3Width * 0.58,
        this.height - 340,
        'fly_shooter',
        area3Start + area3Width * 0.58 - patrolRange * 2,
        area3Start + area3Width * 0.58 + patrolRange * 2
      )
    );

    // ========== 第四区域：地狱区（16只怪：5巡逻 + 4飞行 + 4射手 + 3飞行射手）==========
    // 巡逻怪
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.06,
        this.height - 100,
        'patrol',
        area4Start + area4Width * 0.06 - patrolRange,
        area4Start + area4Width * 0.06 + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.2,
        this.height - 100,
        'patrol',
        area4Start + area4Width * 0.2 - patrolRange,
        area4Start + area4Width * 0.2 + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.38,
        this.height - 100,
        'patrol',
        area4Start + area4Width * 0.38 - patrolRange,
        area4Start + area4Width * 0.38 + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.55,
        this.height - 100,
        'patrol',
        area4Start + area4Width * 0.55 - patrolRange,
        area4Start + area4Width * 0.55 + patrolRange
      )
    );
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.72,
        this.height - 100,
        'patrol',
        area4Start + area4Width * 0.72 - patrolRange,
        area4Start + area4Width * 0.72 + patrolRange
      )
    );
    // 飞行怪
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.12,
        this.height - 380,
        'fly',
        area4Start + area4Width * 0.12 - patrolRange * 2.5,
        area4Start + area4Width * 0.12 + patrolRange * 2.5
      )
    );
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.32,
        this.height - 350,
        'fly',
        area4Start + area4Width * 0.32 - patrolRange * 2,
        area4Start + area4Width * 0.32 + patrolRange * 2
      )
    );
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.52,
        this.height - 320,
        'fly',
        area4Start + area4Width * 0.52 - patrolRange * 2,
        area4Start + area4Width * 0.52 + patrolRange * 2
      )
    );
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.75,
        this.height - 360,
        'fly',
        area4Start + area4Width * 0.75 - patrolRange * 2.5,
        area4Start + area4Width * 0.75 + patrolRange * 2.5
      )
    );
    // 射手
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.25,
        this.height - 100,
        'shooter',
        area4Start + area4Width * 0.25 - patrolRange * 0.5,
        area4Start + area4Width * 0.25 + patrolRange * 0.5
      )
    );
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.45,
        this.height - 100,
        'shooter',
        area4Start + area4Width * 0.45 - patrolRange * 0.5,
        area4Start + area4Width * 0.45 + patrolRange * 0.5
      )
    );
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.65,
        this.height - 100,
        'shooter',
        area4Start + area4Width * 0.65 - patrolRange * 0.5,
        area4Start + area4Width * 0.65 + patrolRange * 0.5
      )
    );
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.82,
        this.height - 100,
        'shooter',
        area4Start + area4Width * 0.82 - patrolRange * 0.5,
        area4Start + area4Width * 0.82 + patrolRange * 0.5
      )
    );
    // 飞行射手
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.18,
        this.height - 300,
        'fly_shooter',
        area4Start + area4Width * 0.18 - patrolRange * 2,
        area4Start + area4Width * 0.18 + patrolRange * 2
      )
    );
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.42,
        this.height - 340,
        'fly_shooter',
        area4Start + area4Width * 0.42 - patrolRange * 2.5,
        area4Start + area4Width * 0.42 + patrolRange * 2.5
      )
    );
    this.enemies.push(
      new Enemy(
        area4Start + area4Width * 0.68,
        this.height - 320,
        'fly_shooter',
        area4Start + area4Width * 0.68 - patrolRange * 2,
        area4Start + area4Width * 0.68 + patrolRange * 2
      )
    );

    // 终点守卫（2只巡逻 + 1射手）
    const guardPos1 = L - L * 0.075;
    const guardPos2 = L - L * 0.055;
    const guardPos3 = L - L * 0.04;
    this.enemies.push(
      new Enemy(guardPos1, this.height - 100, 'patrol', guardPos1 - patrolRange, guardPos1 + patrolRange)
    );
    this.enemies.push(
      new Enemy(guardPos2, this.height - 100, 'shooter', guardPos2 - patrolRange * 0.5, guardPos2 + patrolRange * 0.5)
    );
    this.enemies.push(
      new Enemy(guardPos3, this.height - 100, 'patrol', guardPos3 - patrolRange, guardPos3 + patrolRange)
    );
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
          // 拾取音效（使用挥剑音效代替）
          this.soundManager.slashSword();
          // 拾取大宝剑加分
          this.addBonusScore(1000);
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
      // 更新进度得分（基于勇士X坐标）
      if (this.warrior && !this.victoryTriggered) {
        if (this.warrior.x > this.maxReachedX) {
          this.maxReachedX = this.warrior.x;
        }
        this.score = Math.max(0, this.maxReachedX + this.bonusScore);
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
            this.addKillScore(enemy);
            return;
          }

          // 身体碰撞
          if (this.warrior.checkCollision(enemy)) {
            if (this.warrior.vy > 0 && this.warrior.y < enemy.y) {
              enemy.defeat();
              this.addKillScore(enemy);
              this.warrior.vy = -8;
            } else if (this.warrior.isAttacking && !this.warrior.hasSword) {
              enemy.defeat();
              this.addKillScore(enemy);
            } else if (!this.warrior.isInvulnerable && !this.warrior.isAttacking) {
              this.warrior.takeDamage();
              this.health = this.warrior.health;
              // 扣分由 onDamageCallback 统一处理
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

    // 更新按钮水纹效果
    this.buttonRipples = this.buttonRipples.filter((ripple) => {
      ripple.radius += 3;
      ripple.alpha -= 0.03;
      return ripple.alpha > 0;
    });
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

      // 通关奖励分
      this.addBonusScore(5000);
      // 更新最终得分
      this.score = Math.max(0, this.maxReachedX + this.bonusScore);

      // 清除输入
      this.input.left = false;
      this.input.right = false;
      this.input.jump = false;
      this.input.attack = false;

      // 停止走路音效
      this.soundManager.stopRunning();

      this.createHeartParticles();
      this.soundManager.victory();

      setTimeout(() => {
        this.gameState = 'victory';
      }, 1000);
    }
  }

  // 击杀敌人加分
  addKillScore(enemy) {
    let bonus = 0;
    switch (enemy.type) {
      case 'normal':
        bonus = 500; // 普通地面怪
        break;
      case 'fly':
        bonus = 1000; // 普通飞行怪
        break;
      case 'shooter':
        bonus = 2000; // 地面射击怪
        break;
      case 'fly_shooter':
        bonus = 3000; // 飞行射击怪
        break;
      default:
        bonus = 500;
    }
    this.bonusScore += bonus;
  }

  // 扣分（从奖励分中扣除，确保总分不为负）
  deductScore(amount) {
    const currentTotal = this.maxReachedX + this.bonusScore;
    if (currentTotal <= amount) {
      // 当前分数不足以扣除，直接将奖励分设为负的进度分（使总分为0）
      this.bonusScore = -this.maxReachedX;
    } else {
      this.bonusScore -= amount;
    }
  }

  // 添加奖励分
  addBonusScore(amount) {
    this.bonusScore += amount;
  }

  checkGameOver() {
    if (this.warrior.health <= 0 && !this.gameOverTriggered) {
      this.gameOverTriggered = true;
      this.gameState = 'gameover';
      this.soundManager.stopRunning();
      this.soundManager.defeat(); // 播放主角死亡音效
      // 切换为游戏失败背景音乐（只播放一次）
      this.soundManager.playBackgroundMusic('audio/love_cy.mp3', false);
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
      this.soundManager.stopRunning();
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
    this.soundManager.stopRunning();
    this.initLevel();
    this.gameState = 'playing'; // 在 initLevel 之后设置状态
    this.soundManager.playBackgroundMusic('audio/bg.mp3');
  }

  // 返回菜单
  backToMenu() {
    this.soundManager.stopRunning();
    this.soundManager.playBackgroundMusic('audio/opening_music.mp3');
    this.gameState = 'menu';
  }

  // 渲染游戏
  render() {
    // 重置变换矩阵并应用像素比缩放（确保高清渲染）
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

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
    // 更新动画时间
    this.avatarFloatTime += 16;
    this.menuCloudOffset += 0.3; // 云朵移动速度

    // 背景 - 天蓝色（与游戏界面一致）
    this.ctx.fillStyle = '#87CEEB';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 绘制白云背景（动态）
    this.drawMenuClouds();

    // 更新菜单按钮位置（横屏适配）
    const menuBtnWidth = Math.min(180, (this.width - 80) / 3);
    const menuBtnHeight = Math.min(50, this.height / 5);
    const menuBtnSpacing = 15;
    const totalWidth = menuBtnWidth * 3 + menuBtnSpacing * 2;
    const startX = (this.width - totalWidth) / 2;
    const btnY = this.height / 2 + 20;

    this.menuButtons.start.x = startX;
    this.menuButtons.start.y = btnY;
    this.menuButtons.start.width = menuBtnWidth;
    this.menuButtons.start.height = menuBtnHeight;

    this.menuButtons.help.x = startX + menuBtnWidth + menuBtnSpacing;
    this.menuButtons.help.y = btnY;
    this.menuButtons.help.width = menuBtnWidth;
    this.menuButtons.help.height = menuBtnHeight;

    this.menuButtons.sound.x = startX + (menuBtnWidth + menuBtnSpacing) * 2;
    this.menuButtons.sound.y = btnY;
    this.menuButtons.sound.width = menuBtnWidth;
    this.menuButtons.sound.height = menuBtnHeight;

    // 计算呼吸悬浮效果
    const floatOffset = Math.sin(this.avatarFloatTime / 500) * 6;

    // 标题 - 根据屏幕调整（金色带深色阴影，带呼吸悬浮效果）
    const titleSize = Math.min(48, this.height / 5, this.width / 10);
    this.ctx.font = `bold ${titleSize}px Arial`;
    this.ctx.textAlign = 'center';
    // 文字阴影效果
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.ctx.shadowBlur = 6;
    this.ctx.shadowOffsetX = 2;
    this.ctx.shadowOffsetY = 2;
    this.ctx.fillStyle = '#FFD700'; // 金色标题
    this.ctx.fillText('钱程似金', this.width / 2, this.height / 2 - menuBtnHeight + floatOffset);

    // 副标题（与主标题同步悬浮）
    const subTitleSize = Math.min(20, this.height / 10);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = `${subTitleSize}px Arial`;
    this.ctx.shadowBlur = 4;
    this.ctx.fillText('JinShuo Loves ChengYan', this.width / 2, this.height / 2 - menuBtnHeight / 3 + floatOffset);
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

    // 绘制三个菜单按钮
    const btnRadius = Math.min(25, menuBtnHeight / 2);
    const fontSize = Math.min(18, menuBtnHeight / 2.5);

    // 开始游戏按钮（粉色渐变）
    this.drawGradientButton(this.menuButtons.start, '#f093fb', '#f5576c', btnRadius);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = `bold ${fontSize}px Arial`;
    this.ctx.fillText(
      this.menuButtons.start.label,
      this.menuButtons.start.x + this.menuButtons.start.width / 2,
      this.menuButtons.start.y + this.menuButtons.start.height / 2 + fontSize / 3
    );

    // 游戏说明按钮（蓝色渐变）
    this.drawGradientButton(this.menuButtons.help, '#4facfe', '#00f2fe', btnRadius);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = `bold ${fontSize}px Arial`;
    this.ctx.fillText(
      this.menuButtons.help.label,
      this.menuButtons.help.x + this.menuButtons.help.width / 2,
      this.menuButtons.help.y + this.menuButtons.help.height / 2 + fontSize / 3
    );

    // 音效按钮（绿色渐变）
    const soundColor1 = this.soundManager.enabled ? '#43e97b' : '#8e9eab';
    const soundColor2 = this.soundManager.enabled ? '#38f9d7' : '#a8b5c0';
    this.drawGradientButton(this.menuButtons.sound, soundColor1, soundColor2, btnRadius);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = `bold ${fontSize}px Arial`;
    const soundLabel = this.soundManager.enabled ? '音效: 开' : '音效: 关';
    this.ctx.fillText(
      soundLabel,
      this.menuButtons.sound.x + this.menuButtons.sound.width / 2,
      this.menuButtons.sound.y + this.menuButtons.sound.height / 2 + fontSize / 3
    );

    this.ctx.textAlign = 'left';

    // 显示帮助弹窗
    if (this.showHelp) {
      this.renderHelpPopup();
    }
  }

  // 绘制渐变按钮
  drawGradientButton(btn, color1, color2, radius) {
    const gradient = this.ctx.createLinearGradient(btn.x, btn.y, btn.x + btn.width, btn.y + btn.height);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    this.ctx.fillStyle = gradient;
    this.roundRect(btn.x, btn.y, btn.width, btn.height, radius);
    this.ctx.fill();

    // 添加阴影效果
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetY = 5;
    this.roundRect(btn.x, btn.y, btn.width, btn.height, radius);
    this.ctx.fill();
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetY = 0;
  }

  // 渲染帮助弹窗
  renderHelpPopup() {
    // 半透明背景
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 弹窗
    const popupWidth = Math.min(400, this.width - 40);
    const popupHeight = Math.min(250, this.height - 40);
    const popupX = (this.width - popupWidth) / 2;
    const popupY = (this.height - popupHeight) / 2;

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.roundRect(popupX, popupY, popupWidth, popupHeight, 15);
    this.ctx.fill();

    // 关闭按钮（右上角）
    const closeSize = 28;
    const closePadding = 10;
    const closeX = popupX + popupWidth - closeSize - closePadding;
    const closeY = popupY + closePadding;

    // 保存关闭按钮位置
    this.helpCloseButton.x = closeX;
    this.helpCloseButton.y = closeY;
    this.helpCloseButton.width = closeSize;
    this.helpCloseButton.height = closeSize;

    // 绘制关闭按钮圆形背景
    this.ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
    this.ctx.beginPath();
    this.ctx.arc(closeX + closeSize / 2, closeY + closeSize / 2, closeSize / 2, 0, Math.PI * 2);
    this.ctx.fill();

    // 绘制 X 图标
    this.ctx.strokeStyle = '#555';
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    const xPadding = 8;
    this.ctx.beginPath();
    this.ctx.moveTo(closeX + xPadding, closeY + xPadding);
    this.ctx.lineTo(closeX + closeSize - xPadding, closeY + closeSize - xPadding);
    this.ctx.moveTo(closeX + closeSize - xPadding, closeY + xPadding);
    this.ctx.lineTo(closeX + xPadding, closeY + closeSize - xPadding);
    this.ctx.stroke();

    // 标题
    this.ctx.fillStyle = '#333';
    const titleSize = Math.min(24, popupHeight / 8);
    this.ctx.font = `bold ${titleSize}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('游戏说明', this.width / 2, popupY + 35);

    // 内容
    const contentSize = Math.min(16, popupHeight / 12);
    this.ctx.font = `${contentSize}px Arial`;
    this.ctx.fillStyle = '#555';

    const lines = [
      '← → : 左右移动',
      'B 键 : 跳跃',
      'A 键 : 攻击',
      '',
      '目标：穿越关卡，救出公主！',
      '提示：拾取大宝剑可以增强攻击！',
    ];

    const lineHeight = Math.min(28, popupHeight / 8);
    lines.forEach((line, i) => {
      this.ctx.fillText(line, this.width / 2, popupY + 70 + i * lineHeight);
    });

    this.ctx.textAlign = 'left';
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
      {x: 200, y: 100, w: 100, h: 50},
      {x: 600, y: 150, w: 120, h: 60},
      {x: 1200, y: 80, w: 90, h: 45},
      {x: 1800, y: 120, w: 110, h: 55},
      {x: 2500, y: 90, w: 100, h: 50},
      {x: 3200, y: 140, w: 95, h: 48},
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

  // 菜单界面的云朵（根据屏幕尺寸分布）
  drawMenuClouds() {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

    // 云朵基础位置和速度倍数（不同云朵移动速度略有不同）
    // y 坐标需要确保云朵不超出屏幕上边界（云朵最高点约 y - h*0.6）
    const cloudsBase = [
      {baseX: 0.1, y: Math.max(50, this.height * 0.2), w: 80, h: 40, speed: 1.0},
      {baseX: 0.35, y: Math.max(60, this.height * 0.18), w: 100, h: 50, speed: 0.7},
      {baseX: 0.6, y: Math.max(55, this.height * 0.25), w: 90, h: 45, speed: 1.2},
      {baseX: 0.85, y: Math.max(45, this.height * 0.2), w: 70, h: 35, speed: 0.9},
      {baseX: 0.2, y: this.height * 0.85, w: 60, h: 30, speed: 0.8},
      {baseX: 0.75, y: this.height * 0.8, w: 75, h: 38, speed: 1.1},
    ];

    cloudsBase.forEach((cloud) => {
      // 计算云朵当前 X 位置（从右向左移动，循环）
      let cloudX = this.width * cloud.baseX - this.menuCloudOffset * cloud.speed;

      // 当云朵移出左边界时，从右边重新进入
      const totalWidth = this.width + cloud.w * 2;
      cloudX = (((cloudX % totalWidth) + totalWidth) % totalWidth) - cloud.w;

      this.ctx.beginPath();
      this.ctx.arc(cloudX, cloud.y, cloud.h / 2, Math.PI, 2 * Math.PI);
      this.ctx.arc(cloudX + cloud.w / 2, cloud.y - cloud.h / 4, cloud.h * 0.6, Math.PI, 2 * Math.PI);
      this.ctx.arc(cloudX + cloud.w, cloud.y, cloud.h / 2, Math.PI, 2 * Math.PI);
      this.ctx.closePath();
      this.ctx.fill();
    });
  }

  renderUI() {
    // 更新头像悬浮动画
    this.avatarFloatTime += 16; // 约60fps，每帧16ms
    const floatOffset = Math.sin(this.avatarFloatTime / 500) * 8; // 3秒周期，上下8px

    // 绘制勇士头像（左侧，带悬浮效果）
    this.drawAvatar(this.warriorAvatar, 15, 65 + floatOffset, '勇士', '#4169E1');

    // 绘制公主头像（右侧，带悬浮效果）
    this.drawAvatar(this.princessAvatar, this.width - 70, 55 + floatOffset, '公主', '#FFD700');

    // 生命值（右移给暂停按钮腾出空间）
    for (let i = 0; i < 3; i++) {
      this.ctx.fillStyle = i < this.health ? '#f5576c' : 'rgba(245, 87, 108, 0.3)';
      this.ctx.font = '28px Arial';
      this.ctx.fillText('❤', 70 + i * 35, 40);
    }

    // 得分显示
    const scoreValue = Math.floor(Math.max(0, this.score));
    const scoreText = `得分: ${scoreValue}`;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.roundRect(this.width / 2 - 80, 15, 160, 40, 15);
    this.ctx.fill();

    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = 'bold 20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(scoreText, this.width / 2, 42);
    this.ctx.textAlign = 'left';

    // 暂停按钮（血条左侧）- 用Canvas绘制避免emoji渲染问题
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.roundRect(25, 18, 28, 28, 8);
    this.ctx.fill();

    // 绘制暂停图标（两条竖线）
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(32, 26, 4, 12); // 左竖线
    this.ctx.fillRect(41, 26, 4, 12); // 右竖线

    // 虚拟按钮（增大尺寸和字体）
    this.touchButtons.forEach((btn) => {
      const isPressed = this.pressedButtons[btn.id];
      const centerX = btn.x + btn.width / 2;
      const centerY = btn.y + btn.height / 2;
      const radius = btn.width / 2;

      // 按压时缩小效果
      const scale = isPressed ? 0.9 : 1;
      const drawRadius = radius * scale;

      // 绘制水纹效果
      this.buttonRipples
        .filter((r) => r.btnId === btn.id)
        .forEach((ripple) => {
          this.ctx.beginPath();
          this.ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
          this.ctx.strokeStyle = `rgba(255, 255, 255, ${ripple.alpha})`;
          this.ctx.lineWidth = 3;
          this.ctx.stroke();
        });

      // 按压时颜色变深
      if (isPressed) {
        const baseColor = btn.color || 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillStyle = baseColor.replace(/[\d.]+\)$/, '0.6)');
      } else {
        this.ctx.fillStyle = btn.color || 'rgba(255, 255, 255, 0.3)';
      }
      this.ctx.strokeStyle = isPressed ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)';
      this.ctx.lineWidth = isPressed ? 4 : 3;

      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, drawRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // 绘制按钮内容
      this.ctx.fillStyle = '#FFFFFF';

      if (btn.id === 'left') {
        // 左三角形 ◀（圆角）
        this.ctx.save();
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.lineWidth = 6;
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + 10, centerY - 12);
        this.ctx.lineTo(centerX - 8, centerY);
        this.ctx.lineTo(centerX + 10, centerY + 12);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
      } else if (btn.id === 'right') {
        // 右三角形 ▶（圆角）
        this.ctx.save();
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.lineWidth = 6;
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - 10, centerY - 12);
        this.ctx.lineTo(centerX + 8, centerY);
        this.ctx.lineTo(centerX - 10, centerY + 12);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
      } else {
        // 其他按钮显示文字
        this.ctx.font = 'bold 26px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(btn.label, centerX, centerY + 9);
        this.ctx.textAlign = 'left';
      }
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

    // 横屏适配：计算合适的间距
    const centerY = this.height / 2;
    const btnSpacing = Math.min(45, this.height / 6);

    // 标题
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = `bold ${Math.min(28, this.height / 8)}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('游戏暂停', this.width / 2, centerY - btnSpacing * 1.5);

    // 按钮
    this.renderMenuButton('继续游戏', centerY - btnSpacing * 0.3);
    this.renderMenuButton('重新开始', centerY + btnSpacing * 0.7);
    this.renderMenuButton('返回菜单', centerY + btnSpacing * 1.7);

    this.ctx.textAlign = 'left';
  }

  renderVictoryScreen() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 横屏适配
    const centerY = this.height / 2;
    const btnSpacing = Math.min(45, this.height / 6);

    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = `bold ${Math.min(28, this.height / 8)}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('🎉 恭喜通关!', this.width / 2, centerY - btnSpacing * 2);

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = `${Math.min(18, this.height / 12)}px Arial`;
    this.ctx.fillText('喜结良缘，钱程似锦！', this.width / 2, centerY - btnSpacing * 1.2);

    // 显示总得分
    const finalScore = Math.floor(Math.max(0, this.score));
    this.ctx.fillStyle = '#00FF00';
    this.ctx.font = `bold ${Math.min(22, this.height / 10)}px Arial`;
    this.ctx.fillText(`总得分: ${finalScore}`, this.width / 2, centerY - btnSpacing * 0.3);

    this.renderMenuButton('再玩一次', centerY + btnSpacing * 0.7);
    this.renderMenuButton('返回菜单', centerY + btnSpacing * 1.7);

    this.ctx.textAlign = 'left';
  }

  renderGameOverScreen() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 横屏适配
    const centerY = this.height / 2;
    const btnSpacing = Math.min(45, this.height / 6);

    this.ctx.fillStyle = '#FF6B6B';
    this.ctx.font = `bold ${Math.min(24, this.height / 10)}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('燕子，没有你我怎么活啊~', this.width / 2, centerY - btnSpacing * 1.5);

    // 显示总得分
    const finalScore = Math.floor(Math.max(0, this.score));
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = `bold ${Math.min(20, this.height / 11)}px Arial`;
    this.ctx.fillText(`总得分: ${finalScore}`, this.width / 2, centerY - btnSpacing * 0.5);

    this.renderMenuButton('重新开始', centerY + btnSpacing * 0.5);
    this.renderMenuButton('返回菜单', centerY + btnSpacing * 1.5);

    this.ctx.textAlign = 'left';
  }

  renderMenuButton(text, y) {
    const btnWidth = 160;
    const btnHeight = 40;

    this.ctx.fillStyle = 'rgba(255, 105, 180, 0.8)';
    this.roundRect(this.width / 2 - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 20);
    this.ctx.fill();

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = `bold ${Math.min(16, this.height / 15)}px Arial`;
    this.ctx.fillText(text, this.width / 2, y + 5);
  }

  // 绘制头像（带圆形裁剪和标签）
  drawAvatar(image, x, y, label, borderColor) {
    const avatarSize = 50; // 头像尺寸
    const centerX = x + avatarSize / 2;
    const centerY = y + avatarSize / 2;
    const radius = avatarSize / 2;

    this.ctx.save();

    // 启用图像平滑以提高质量
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // 绘制阴影（悬浮效果）
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetY = 4;

    // 绘制圆形裁剪区域
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.closePath();
    this.ctx.clip();

    // 绘制头像图片（从原图中心裁剪正方形区域）
    if (image && image.complete && image.width > 0) {
      // 计算源图片的裁剪区域（取中心正方形）
      const srcSize = Math.min(image.width, image.height);
      const srcX = (image.width - srcSize) / 2;
      const srcY = (image.height - srcSize) / 2;

      // 从源图片中心裁剪，绘制到目标位置
      this.ctx.drawImage(image, srcX, srcY, srcSize, srcSize, x, y, avatarSize, avatarSize);
    } else {
      // 如果图片未加载，显示占位
      this.ctx.fillStyle = borderColor;
      this.ctx.fillRect(x, y, avatarSize, avatarSize);
    }

    this.ctx.restore();

    // 绘制边框（带阴影）
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    this.ctx.shadowBlur = 6;
    this.ctx.shadowOffsetY = 3;
    this.ctx.strokeStyle = borderColor;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();

    // 绘制标签背景
    const labelWidth = 40;
    const labelHeight = 18;
    const labelX = centerX - labelWidth / 2;
    const labelY = y + avatarSize + 5;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.roundRect(labelX, labelY, labelWidth, labelHeight, 9);
    this.ctx.fill();

    // 绘制标签文字
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(label, centerX, labelY + 13);
    this.ctx.textAlign = 'left';
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
