<template>
  <view class="game-container">
    <canvas
      id="gameCanvas"
      canvas-id="gameCanvas"
      class="game-canvas"
      :disable-scroll="true"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
    ></canvas>

    <!-- UI 层 -->
    <view class="game-ui">
      <!-- 生命值显示 -->
      <view class="health-bar">
        <text v-for="(item, index) in 3" :key="index" class="heart" :class="{lost: index >= health}">❤</text>
      </view>

      <!-- 勇士头像 -->
      <view v-if="gameState === 'playing'" class="warrior-float">
        <image :src="warriorImgSrc" class="warrior-avatar"></image>
        <text class="avatar-label">勇士</text>
      </view>

      <!-- 计时器显示 -->
      <view v-if="gameState === 'playing' || gameState === 'victory'" class="timer-display">
        <text class="timer-text">{{ formattedTime }}</text>
      </view>

      <!-- 暂停按钮 -->
      <button class="pause-btn" @click="pauseGame">⏸</button>

      <!-- 公主头像悬浮 -->
      <view v-if="gameState === 'playing'" class="princess-float">
        <image :src="princessImgSrc" class="princess-avatar"></image>
        <text class="avatar-label">公主</text>
      </view>
    </view>

    <!-- 虚拟按钮 -->
    <view class="controls">
      <view class="left-controls">
        <button class="control-btn" @touchstart="onTouchLeft" @touchend="onReleaseLeft">←</button>
        <button class="control-btn" @touchstart="onTouchRight" @touchend="onReleaseRight">→</button>
      </view>
      <view class="right-controls">
        <button class="control-btn jump-btn" @touchstart="onTouchJump" @touchend="onReleaseJump">B</button>
        <button class="control-btn attack-btn" @touchstart="onTouchAttack" @touchend="onReleaseAttack">A</button>
      </view>
    </view>

    <!-- 暂停菜单 -->
    <view v-if="gameState === 'paused'" class="pause-menu">
      <view class="menu-content">
        <text class="menu-title">游戏暂停</text>
        <button class="menu-btn" @click="resumeGame">继续游戏</button>
        <button class="menu-btn" @click="restartGame">重新开始</button>
        <button class="menu-btn" @click="backToMenu">返回菜单</button>
      </view>
    </view>

    <!-- 胜利界面 -->
    <view v-if="gameState === 'victory'" class="victory-screen">
      <view class="victory-content">
        <text class="victory-title">🎉 恭喜通关!</text>
        <text class="victory-text">喜结良缘，钱程似锦！</text>
        <button class="menu-btn" @click="restartGame">再玩一次</button>
        <button class="menu-btn" @click="backToMenu">返回菜单</button>
      </view>
    </view>

    <!-- 游戏结束界面 -->
    <view v-if="gameState === 'gameover'" class="gameover-screen">
      <view class="gameover-content">
        <text class="gameover-title">燕子，没有你我怎么活啊~</text>
        <button class="menu-btn" @click="restartGame">重新开始</button>
        <button class="menu-btn" @click="backToMenu">返回菜单</button>
      </view>
    </view>
  </view>
</template>

<script>
import {SoundManager, Warrior, Princess, Platform, Enemy, Trap, Bullet, Item} from '@/components/GameClasses.js';

export default {
  data() {
    return {
      canvas: null,
      ctx: null,
      width: 0,
      height: 0,
      gameState: 'intro',

      soundManager: null,
      warrior: null,
      princess: null,
      platforms: [],
      enemies: [],
      traps: [],
      items: [], // 道具
      bullets: [], // 所有活跃的子弹
      hearts: [],
      cameraX: 0,

      levelWidth: 12000,

      // 计时系统
      gameTimer: 0, // 游戏计时（毫秒）
      timerStarted: false,
      health: 3,
      victoryTriggered: false,

      keys: {},
      touches: {
        left: false,
        right: false,
        jump: false,
        attack: false,
      },

      animationFrame: null,
      lastTime: 0,

      introStage: 0,
      introTime: 0,

      warriorImg: null,
      princessImg: null,
      warriorSprites: {},

      warriorImgSrc: '/static/assets/warrior.jpg',
      princessImgSrc: '/static/assets/princess.jpg',
    };
  },
  computed: {
    // 格式化计时器显示（精确到毫秒，如 12.138）
    formattedTime() {
      const totalSeconds = this.gameTimer / 1000;
      const seconds = Math.floor(totalSeconds);
      const milliseconds = Math.floor((totalSeconds - seconds) * 1000);
      return `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
    },
  },
  onLoad() {
    // 使用 nextTick 确保 DOM 已经渲染
    this.$nextTick(() => {
      this.initGame();
    });
  },
  onUnload() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    // 停止背景音乐
    if (this.soundManager) {
      this.soundManager.stopBackgroundMusic();
    }
  },
  methods: {
    initGame() {
      const systemInfo = uni.getSystemInfoSync();
      this.width = systemInfo.windowWidth;
      this.height = systemInfo.windowHeight;

      // 使用 uni-app canvas context
      this.ctx = uni.createCanvasContext('gameCanvas', this);

      this.loadImages();
      this.setupKeyboard();

      const soundEnabled = uni.getStorageSync('soundEnabled');
      this.soundManager = new SoundManager();
      this.soundManager.enabled = soundEnabled !== false;

      this.startGameLoop();
    },

    loadImages() {
      // 简化图像加载 - 使用原生 Image 对象
      this.warriorImg = new Image();
      this.warriorImg.src = this.warriorImgSrc;

      this.princessImg = new Image();
      this.princessImg.src = this.princessImgSrc;

      this.warriorSprites = {
        idle: new Image(),
        walk: [],
        jump: new Image(),
        attack: [],
      };

      this.warriorSprites.idle.src = '/static/assets/MaleAdventurer/PNG/Poses/character_maleAdventurer_idle.png';
      this.warriorSprites.jump.src = '/static/assets/MaleAdventurer/PNG/Poses/character_maleAdventurer_jump.png';

      for (let i = 0; i < 8; i++) {
        const walkImg = new Image();
        walkImg.src = `/static/assets/MaleAdventurer/PNG/Poses/character_maleAdventurer_walk${i}.png`;
        this.warriorSprites.walk.push(walkImg);
      }

      for (let i = 0; i < 3; i++) {
        const attackImg = new Image();
        attackImg.src = `/static/assets/MaleAdventurer/PNG/Poses/character_maleAdventurer_attack${i}.png`;
        this.warriorSprites.attack.push(attackImg);
      }

      setTimeout(() => {
        this.initLevel();
      }, 500);
    },

    setupKeyboard() {
      // PC键盘支持
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (e) => {
          this.keys[e.key] = true;
          if (e.key === ' ') e.preventDefault();
        });

        window.addEventListener('keyup', (e) => {
          this.keys[e.key] = false;
        });
      }
    },

    initLevel() {
      this.warrior = new Warrior(100, 300, this.warriorImg, this.soundManager, this.warriorSprites, this.warriorImgSrc);
      // 让公主站在地面上：地面在 height - 50，公主高度 60，所以 y = height - 50 - 60
      // 公主位置设置在关卡末端
      this.princess = new Princess(this.levelWidth - 300, this.height - 110, this.princessImg, this.princessImgSrc);

      this.createPlatforms();
      this.createEnemies();
      this.createTraps();
      this.createItems();
      this.bullets = []; // 重置子弹

      this.cameraX = 0;
      this.health = this.warrior.health;
      this.victoryTriggered = false;
      this.gameState = 'playing';

      // 重置计时器
      this.gameTimer = 0;
      this.timerStarted = true;

      // 播放背景音乐
      if (this.soundManager && !this.soundManager.bgMusic) {
        this.soundManager.playBackgroundMusic('/static/assets/music/bg.mp3');
      }
    },

    createPlatforms() {
      this.platforms = [];
      const L = this.levelWidth;

      // 定义四个主区域
      const area1Start = 0;
      const area1End = L * 0.25; // 第一区域：0 ~ 1/4
      const area2Start = area1End;
      const area2End = L * 0.5; // 第二区域：1/4 ~ 1/2
      const area3Start = area2End;
      const area3End = L * 0.75; // 第三区域：1/2 ~ 3/4
      const area4Start = area3End;
      const area4End = L; // 第四区域：3/4 ~ 1

      // 区域宽度
      const area1Width = area1End - area1Start;
      const area2Width = area2End - area2Start;
      const area3Width = area3End - area3Start;
      const area4Width = area4End - area4Start;

      // 地面平台
      this.platforms.push(new Platform(0, this.height - 50, L, 50, 'ground'));

      // ========== 第一区域：起始区 ==========
      // 子区域划分：5个平台均匀分布
      const sub1_1 = area1Start + area1Width * 0.1;
      const sub1_2 = area1Start + area1Width * 0.25;
      const sub1_3 = area1Start + area1Width * 0.4;
      const sub1_4 = area1Start + area1Width * 0.55;
      const sub1_5 = area1Start + area1Width * 0.75;

      this.platforms.push(new Platform(sub1_1, this.height - 150, 200, 20, 'platform'));
      this.platforms.push(new Platform(sub1_2, this.height - 200, 150, 20, 'platform'));
      this.platforms.push(new Platform(sub1_3, this.height - 250, 180, 20, 'platform'));
      this.platforms.push(new Platform(sub1_4, this.height - 180, 160, 20, 'platform'));
      this.platforms.push(new Platform(sub1_5, this.height - 220, 200, 20, 'platform'));

      // ========== 第二区域：中间挑战区 ==========
      // 10个平台，使用循环生成波浪形分布
      const platformCount2 = 10;
      const platformSpacing2 = area2Width / platformCount2;
      for (let i = 0; i < platformCount2; i++) {
        const x = area2Start + i * platformSpacing2;
        const y = this.height - 150 - Math.sin(i * 0.6) * 120;
        this.platforms.push(new Platform(x, y, 160, 20, 'platform'));
      }

      // ========== 第三区域：高空区 ==========
      // 6个平台均匀分布
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

      // ========== 第四区域：最终挑战区 ==========
      // 8个平台，使用循环生成余弦波形分布
      const platformCount4 = 8;
      const platformSpacing4 = area4Width / platformCount4;
      for (let i = 0; i < platformCount4; i++) {
        const x = area4Start + i * platformSpacing4;
        const y = this.height - 180 - Math.cos(i * 0.5) * 100;
        this.platforms.push(new Platform(x, y, 170, 20, 'platform'));
      }

      // 终点区域平台
      const endZone1 = L - L * 0.0625; // 距终点 6.25%
      const endZone2 = L - L * 0.0375; // 距终点 3.75%
      this.platforms.push(new Platform(endZone1, this.height - 150, 300, 20, 'platform'));
      this.platforms.push(new Platform(endZone2, this.height - 100, 300, 20, 'platform'));
    },

    createEnemies() {
      this.enemies = [];
      const L = this.levelWidth;

      // 定义四个主区域
      const area1Start = 0;
      const area1End = L * 0.25;
      const area2Start = area1End;
      const area2End = L * 0.5;
      const area3Start = area2End;
      const area3End = L * 0.75;
      const area4Start = area3End;
      const area4End = L;

      // 区域宽度
      const area1Width = area1End - area1Start;
      const area2Width = area2End - area2Start;
      const area3Width = area3End - area3Start;
      const area4Width = area4End - area4Start;

      // 巡逻范围宽度（固定值，不随关卡长度变化，确保游戏体验一致）
      const patrolRange = 200;

      // ========== 第一区域敌人 ==========
      const e1_1 = area1Start + area1Width * 0.25;
      const e1_2 = area1Start + area1Width * 0.5;
      const e1_3 = area1Start + area1Width * 0.65;
      this.enemies.push(new Enemy(e1_1, this.height - 100, 'patrol', e1_1 - patrolRange, e1_1 + patrolRange));
      this.enemies.push(new Enemy(e1_2, this.height - 100, 'patrol', e1_2 - patrolRange, e1_2 + patrolRange));
      this.enemies.push(new Enemy(e1_3, this.height - 280, 'fly', e1_3 - patrolRange * 2, e1_3 + patrolRange * 2));

      // ========== 第二区域敌人 ==========
      const e2_1 = area2Start + area2Width * 0.05;
      const e2_2 = area2Start + area2Width * 0.3;
      const e2_3 = area2Start + area2Width * 0.55;
      const e2_4 = area2Start + area2Width * 0.2;
      const e2_5 = area2Start + area2Width * 0.7;
      const e2_6 = area2Start + area2Width * 0.85; // 射击怪物位置
      const e2_7 = area2Start + area2Width * 0.45; // 飞行射击怪物位置
      this.enemies.push(new Enemy(e2_1, this.height - 100, 'patrol', e2_1 - patrolRange, e2_1 + patrolRange));
      this.enemies.push(new Enemy(e2_2, this.height - 100, 'patrol', e2_2 - patrolRange, e2_2 + patrolRange));
      this.enemies.push(new Enemy(e2_3, this.height - 100, 'patrol', e2_3 - patrolRange, e2_3 + patrolRange));
      this.enemies.push(new Enemy(e2_4, this.height - 350, 'fly', e2_4 - patrolRange * 2.5, e2_4 + patrolRange * 2.5));
      this.enemies.push(new Enemy(e2_5, this.height - 320, 'fly', e2_5 - patrolRange * 2, e2_5 + patrolRange * 2));
      // 射击怪物 - 站在平台上
      this.enemies.push(
        new Enemy(e2_6, this.height - 100, 'shooter', e2_6 - patrolRange * 0.5, e2_6 + patrolRange * 0.5)
      );
      // 飞行射击怪物 - 飞龙
      this.enemies.push(
        new Enemy(e2_7, this.height - 280, 'fly_shooter', e2_7 - patrolRange * 2, e2_7 + patrolRange * 2)
      );

      // ========== 第三区域敌人 ==========
      const e3_1 = area3Start + area3Width * 0.1;
      const e3_2 = area3Start + area3Width * 0.4;
      const e3_3 = area3Start + area3Width * 0.25;
      const e3_4 = area3Start + area3Width * 0.6;
      const e3_5 = area3Start + area3Width * 0.75; // 射击怪物位置
      const e3_6 = area3Start + area3Width * 0.5; // 飞行射击怪物位置
      this.enemies.push(new Enemy(e3_1, this.height - 100, 'patrol', e3_1 - patrolRange, e3_1 + patrolRange));
      this.enemies.push(new Enemy(e3_2, this.height - 100, 'patrol', e3_2 - patrolRange, e3_2 + patrolRange));
      this.enemies.push(new Enemy(e3_3, this.height - 400, 'fly', e3_3 - patrolRange * 2, e3_3 + patrolRange * 2));
      this.enemies.push(new Enemy(e3_4, this.height - 350, 'fly', e3_4 - patrolRange * 2, e3_4 + patrolRange * 2));
      // 射击怪物
      this.enemies.push(
        new Enemy(e3_5, this.height - 100, 'shooter', e3_5 - patrolRange * 0.5, e3_5 + patrolRange * 0.5)
      );
      // 飞行射击怪物 - 飞龙
      this.enemies.push(
        new Enemy(e3_6, this.height - 320, 'fly_shooter', e3_6 - patrolRange * 2.5, e3_6 + patrolRange * 2.5)
      );

      // ========== 第四区域敌人 ==========
      const e4_1 = area4Start + area4Width * 0.1;
      const e4_2 = area4Start + area4Width * 0.35;
      const e4_3 = area4Start + area4Width * 0.6;
      const e4_4 = area4Start + area4Width * 0.25;
      const e4_5 = area4Start + area4Width * 0.7;
      const e4_6 = area4Start + area4Width * 0.5; // 射击怪物位置
      const e4_7 = area4Start + area4Width * 0.85; // 射击怪物位置
      const e4_8 = area4Start + area4Width * 0.4; // 飞行射击怪物位置
      const e4_9 = area4Start + area4Width * 0.75; // 飞行射击怪物位置
      this.enemies.push(new Enemy(e4_1, this.height - 100, 'patrol', e4_1 - patrolRange, e4_1 + patrolRange));
      this.enemies.push(new Enemy(e4_2, this.height - 100, 'patrol', e4_2 - patrolRange, e4_2 + patrolRange));
      this.enemies.push(new Enemy(e4_3, this.height - 100, 'patrol', e4_3 - patrolRange, e4_3 + patrolRange));
      this.enemies.push(new Enemy(e4_4, this.height - 350, 'fly', e4_4 - patrolRange * 2.5, e4_4 + patrolRange * 2.5));
      this.enemies.push(new Enemy(e4_5, this.height - 380, 'fly', e4_5 - patrolRange * 2.5, e4_5 + patrolRange * 2.5));
      // 射击怪物（最后区域增加难度，放2个）
      this.enemies.push(
        new Enemy(e4_6, this.height - 100, 'shooter', e4_6 - patrolRange * 0.5, e4_6 + patrolRange * 0.5)
      );
      this.enemies.push(
        new Enemy(e4_7, this.height - 100, 'shooter', e4_7 - patrolRange * 0.5, e4_7 + patrolRange * 0.5)
      );
      // 飞行射击怪物 - 飞龙（最后区域放2只增加难度）
      this.enemies.push(
        new Enemy(e4_8, this.height - 300, 'fly_shooter', e4_8 - patrolRange * 2, e4_8 + patrolRange * 2)
      );
      this.enemies.push(
        new Enemy(e4_9, this.height - 350, 'fly_shooter', e4_9 - patrolRange * 2.5, e4_9 + patrolRange * 2.5)
      );

      // 终点区域守卫
      const guardPos = L - L * 0.0875;
      this.enemies.push(
        new Enemy(guardPos, this.height - 100, 'patrol', guardPos - patrolRange, guardPos + patrolRange)
      );
    },

    createTraps() {
      this.traps = [];
      const L = this.levelWidth;

      // 定义四个主区域
      const area1Start = 0;
      const area1End = L * 0.25;
      const area2Start = area1End;
      const area2End = L * 0.5;
      const area3Start = area2End;
      const area3End = L * 0.75;
      const area4Start = area3End;
      const area4End = L;

      // 区域宽度
      const area1Width = area1End - area1Start;
      const area2Width = area2End - area2Start;
      const area3Width = area3End - area3Start;
      const area4Width = area4End - area4Start;

      // 陷阱尺寸（固定值，不随关卡长度变化，确保玩家始终能跨越）
      const pitWidth = 180; // 坑宽度
      const spikeWidth = 140; // 尖刺宽度

      // ========== 第一区域陷阱 ==========
      const t1_1 = area1Start + area1Width * 0.35;
      const t1_2 = area1Start + area1Width * 0.55;
      this.traps.push(new Trap(t1_1, this.height - 50, pitWidth, 100, 'pit'));
      this.traps.push(new Trap(t1_2, this.height - 70, spikeWidth, 20, 'spike'));

      // ========== 第二区域陷阱 ==========
      const t2_1 = area2Start + area2Width * 0.175;
      const t2_2 = area2Start + area2Width * 0.4;
      const t2_3 = area2Start + area2Width * 0.625;
      const t2_4 = area2Start + area2Width * 0.825;
      this.traps.push(new Trap(t2_1, this.height - 70, spikeWidth, 20, 'spike'));
      this.traps.push(new Trap(t2_2, this.height - 50, pitWidth, 100, 'pit'));
      this.traps.push(new Trap(t2_3, this.height - 70, spikeWidth, 20, 'spike'));
      this.traps.push(new Trap(t2_4, this.height - 50, pitWidth, 100, 'pit'));

      // ========== 第三区域陷阱 ==========
      const t3_1 = area3Start + area3Width * 0.175;
      const t3_2 = area3Start + area3Width * 0.425;
      const t3_3 = area3Start + area3Width * 0.675;
      const t3_4 = area3Start + area3Width * 0.875;
      this.traps.push(new Trap(t3_1, this.height - 70, spikeWidth, 20, 'spike'));
      this.traps.push(new Trap(t3_2, this.height - 50, pitWidth, 100, 'pit'));
      this.traps.push(new Trap(t3_3, this.height - 70, spikeWidth, 20, 'spike'));
      this.traps.push(new Trap(t3_4, this.height - 50, pitWidth, 100, 'pit'));

      // ========== 第四区域陷阱 ==========
      const t4_1 = area4Start + area4Width * 0.175;
      const t4_2 = area4Start + area4Width * 0.425;
      const t4_3 = area4Start + area4Width * 0.65;
      const t4_4 = area4Start + area4Width * 0.8;
      this.traps.push(new Trap(t4_1, this.height - 70, spikeWidth, 20, 'spike'));
      this.traps.push(new Trap(t4_2, this.height - 50, pitWidth, 100, 'pit'));
      this.traps.push(new Trap(t4_3, this.height - 70, spikeWidth, 20, 'spike'));
      this.traps.push(new Trap(t4_4, this.height - 50, pitWidth, 100, 'pit'));
    },

    createItems() {
      this.items = [];
      const L = this.levelWidth;

      // 定义四个主区域
      const area1End = L * 0.25;
      const area2Start = area1End;
      const area2End = L * 0.5;

      // 区域宽度
      const area1Width = area1End;
      const area2Width = area2End - area2Start;

      // 在第一区域末尾放置大宝剑（让玩家较早获得）
      const swordX = area1Width * 0.8;
      this.items.push(new Item(swordX, this.height - 130, 'sword'));
    },

    // 检测道具拾取
    checkItemPickup() {
      this.items.forEach((item) => {
        if (item.collected) return;

        // 碰撞检测
        const collision =
          this.warrior.x < item.x + item.width &&
          this.warrior.x + this.warrior.width > item.x &&
          this.warrior.y < item.y + item.height + 10 && // 稍微放宽高度检测
          this.warrior.y + this.warrior.height > item.y;

        if (collision) {
          item.collected = true;

          // 根据道具类型应用效果
          if (item.type === 'sword') {
            this.warrior.equipSword();
            this.soundManager.playSound(800, 0.2, 'sine'); // 拾取音效
          }
        }
      });
    },

    update(deltaTime) {
      if (this.gameState === 'playing') {
        // 更新计时器（仅在游戏进行中且未触发胜利时）
        if (this.timerStarted && !this.victoryTriggered) {
          this.gameTimer += deltaTime;
        }

        const input = {
          left:
            !this.victoryTriggered && (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A'] || this.touches.left),
          right:
            !this.victoryTriggered &&
            (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D'] || this.touches.right),
          jump: this.keys[' '] || this.touches.jump,
          attack: this.keys['j'] || this.keys['J'] || this.touches.attack,
        };

        this.warrior.update(deltaTime, input, this.platforms, this.traps, this.levelWidth);

        // 同步血量（陷阱伤害会在 warrior.update 中更新 warrior.health）
        this.health = this.warrior.health;

        // 更新公主动画
        if (this.princess) {
          this.princess.updateAnimation(deltaTime);
        }

        // 更新道具
        this.items.forEach((item) => item.update(deltaTime));

        // 检测道具拾取
        this.checkItemPickup();

        // 更新敌人（传递勇士位置给射击怪物，包括 x 和 y 坐标用于瞄准）
        this.enemies.forEach((enemy) => enemy.update(deltaTime, this.warrior.x, this.warrior.y));

        // 处理射击怪物发射子弹（支持 shooter 和 fly_shooter）
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
        // 移除超出范围的子弹
        this.bullets = this.bullets.filter(
          (bullet) => bullet.active && !bullet.isOutOfBounds(this.cameraX, this.width)
        );

        // 检测子弹与勇士的碰撞
        this.bullets.forEach((bullet) => {
          if (bullet.active && this.checkBulletHit(bullet)) {
            bullet.active = false;
            if (!this.warrior.isInvulnerable) {
              this.warrior.takeDamage();
              this.health = this.warrior.health;
            }
          }
        });

        this.enemies.forEach((enemy) => {
          if (this.warrior.checkCollision(enemy) && !enemy.defeated) {
            // 方式1：跳跃踩踏击杀
            if (this.warrior.vy > 0 && this.warrior.y < enemy.y) {
              enemy.defeat();
              this.warrior.vy = -8;
              this.soundManager.defeat();
            }
            // 方式2：攻击击杀（检测攻击状态和攻击范围）
            else if (this.warrior.isAttacking && this.checkAttackHit(enemy)) {
              enemy.defeat();
              this.soundManager.defeat();
            }
            // 否则玩家受伤
            else if (!this.warrior.isInvulnerable && !this.warrior.isAttacking) {
              this.warrior.takeDamage();
              this.health = this.warrior.health;
            }
          }
        });

        this.updateCamera();
        this.checkVictory();
        this.checkGameOver();
      }

      // 无论什么状态，只要触发了胜利就更新爱心粒子
      if (this.victoryTriggered) {
        this.hearts.forEach((heart) => {
          heart.x += heart.vx;
          heart.y += heart.vy;
          heart.rotation += heart.rotationSpeed;
        });
      }
    },

    // 检测子弹是否击中勇士
    checkBulletHit(bullet) {
      return (
        bullet.x < this.warrior.x + this.warrior.width &&
        bullet.x + bullet.width > this.warrior.x &&
        bullet.y < this.warrior.y + this.warrior.height &&
        bullet.y + bullet.height > this.warrior.y
      );
    },

    // 检测攻击是否击中敌人（基于勇士面朝方向的攻击范围）
    checkAttackHit(enemy) {
      const attackRange = this.warrior.getAttackRange(); // 攻击范围（持剑时更大）
      const warrior = this.warrior;

      // 根据勇士面朝方向确定攻击区域
      let attackX, attackWidth;
      if (warrior.direction === 1) {
        // 面向右：攻击区域在勇士右侧
        attackX = warrior.x + warrior.width;
        attackWidth = attackRange;
      } else {
        // 面向左：攻击区域在勇士左侧
        attackX = warrior.x - attackRange;
        attackWidth = attackRange;
      }

      // 检测攻击区域与敌人是否重叠
      const hitX = attackX < enemy.x + enemy.width && attackX + attackWidth > enemy.x;
      const hitY = warrior.y < enemy.y + enemy.height && warrior.y + warrior.height > enemy.y;

      return hitX && hitY;
    },

    updateCamera() {
      const targetX = this.warrior.x - this.width / 3;
      this.cameraX = Math.max(0, Math.min(targetX, this.levelWidth - this.width));
    },

    checkVictory() {
      // 使用精确的碰撞检测：检查勇士和公主的矩形是否重叠
      const collision =
        this.warrior.x < this.princess.x + this.princess.width &&
        this.warrior.x + this.warrior.width > this.princess.x &&
        this.warrior.y < this.princess.y + this.princess.height &&
        this.warrior.y + this.warrior.height > this.princess.y;

      if (collision && !this.victoryTriggered) {
        this.victoryTriggered = true;

        // 清除所有移动输入状态，使勇士立即停止移动
        this.touches.left = false;
        this.touches.right = false;
        this.touches.jump = false;
        this.touches.attack = false;

        this.createHeartParticles();
        this.soundManager.victory();

        // 延迟2秒弹出胜利弹窗
        setTimeout(() => {
          this.gameState = 'victory';
        }, 1000);
      }
    },

    checkGameOver() {
      if (this.warrior.health <= 0) {
        this.gameState = 'gameover';
      }
    },

    createHeartParticles() {
      this.hearts = [];
      // 计算公主在屏幕上的位置（世界坐标 - 相机偏移）
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
    },

    render() {
      if (!this.ctx) return;

      this.ctx.fillStyle = '#87CEEB';
      this.ctx.fillRect(0, 0, this.width, this.height);

      this.ctx.save();
      this.ctx.translate(-this.cameraX, 0);

      this.drawClouds();

      // Add null checks before drawing game objects
      if (this.platforms.length > 0) {
        this.platforms.forEach((platform) => platform.draw(this.ctx));
      }
      if (this.traps.length > 0) {
        this.traps.forEach((trap) => trap.draw(this.ctx));
      }
      // 绘制道具
      if (this.items.length > 0) {
        this.items.forEach((item) => item.draw(this.ctx));
      }
      if (this.enemies.length > 0) {
        this.enemies.forEach((enemy) => enemy.draw(this.ctx));
      }
      // 绘制子弹
      if (this.bullets.length > 0) {
        this.bullets.forEach((bullet) => bullet.draw(this.ctx));
      }
      if (this.princess) {
        this.princess.draw(this.ctx);
      }
      if (this.warrior) {
        this.warrior.draw(this.ctx);
      }

      this.ctx.restore();

      // 只要触发了胜利就渲染爱心粒子
      if (this.victoryTriggered) {
        this.renderHeartParticles();
      }

      // uni-app canvas 需要调用 draw() 来提交渲染
      // 图像可能会有错误，但几何图形应该能正常渲染
      if (typeof this.ctx.draw === 'function') {
        this.ctx.draw();
      }
    },

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
    },

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
    },

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
    },

    // 触摸控制
    onTouchLeft() {
      this.touches.left = true;
    },
    onReleaseLeft() {
      this.touches.left = false;
    },
    onTouchRight() {
      this.touches.right = true;
    },
    onReleaseRight() {
      this.touches.right = false;
    },
    onTouchJump() {
      this.touches.jump = true;
    },
    onReleaseJump() {
      this.touches.jump = false;
    },
    onTouchAttack() {
      this.touches.attack = true;
    },
    onReleaseAttack() {
      this.touches.attack = false;
    },

    handleTouchStart(e) {
      // 可以添加额外的触摸处理逻辑
    },
    handleTouchEnd(e) {
      // 可以添加额外的触摸处理逻辑
    },

    pauseGame() {
      if (this.gameState === 'playing') {
        this.gameState = 'paused';
        // 暂停背景音乐
        if (this.soundManager) {
          this.soundManager.pauseBackgroundMusic();
        }
      }
    },
    resumeGame() {
      if (this.gameState === 'paused') {
        this.gameState = 'playing';
        // 恢复背景音乐
        if (this.soundManager) {
          this.soundManager.resumeBackgroundMusic();
        }
      }
    },
    restartGame() {
      // 先停止旧的背景音乐
      if (this.soundManager && this.soundManager.bgMusic) {
        this.soundManager.stopBackgroundMusic();
      }

      this.gameState = 'playing';
      this.initLevel();
    },
    backToMenu() {
      // 停止背景音乐
      if (this.soundManager) {
        this.soundManager.stopBackgroundMusic();
      }
      // 使用 redirectTo 确保能返回主菜单
      uni.redirectTo({
        url: '/pages/index/index',
      });
    },
  },
};
</script>

<style scoped>
.game-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background-color: #87ceeb;
}

.game-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.game-ui {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.health-bar {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  gap: 10px;
  pointer-events: none;
}

.heart {
  font-size: 30px;
  color: #f5576c;
  transition: opacity 0.3s;
}

.heart.lost {
  opacity: 0.3;
}

.timer-display {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  padding: 8px 20px;
  border-radius: 15px;
  pointer-events: none;
}

.timer-text {
  font-size: 24px;
  font-weight: bold;
  color: #ffd700;
  font-family: 'Courier New', monospace;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  letter-spacing: 1px;
}

.pause-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  height: 35px;
  line-height: 35px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 24px;
  pointer-events: auto;
}

.warrior-float {
  position: absolute;
  top: 80px;
  left: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  animation: float 3s ease-in-out infinite;
  pointer-events: none;
}

.warrior-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 3px solid #4169e1;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.princess-float {
  position: absolute;
  top: 80px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  animation: float 3s ease-in-out infinite;
  pointer-events: none;
}

.princess-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 3px solid #ffd700;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.avatar-label {
  font-size: 12px;
  color: white;
  background: rgba(0, 0, 0, 0.6);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.controls {
  position: fixed;
  bottom: 20px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 20px;
  pointer-events: none;
}

.left-controls,
.right-controls {
  display: flex;
  gap: 15px;
}

.control-btn {
  width: 60px;
  height: 60px;
  background: rgba(255, 255, 255, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  color: white;
  font-size: 20px;
  font-weight: bold;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.jump-btn {
  background: rgba(76, 175, 80, 0.5);
}

.attack-btn {
  background: rgba(244, 67, 54, 0.5);
}

.pause-menu,
.victory-screen,
.gameover-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.menu-content,
.victory-content,
.gameover-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40px;
  border-radius: 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.menu-title,
.victory-title,
.gameover-title {
  font-size: 36px;
  font-weight: bold;
  color: white;
}

.victory-text {
  font-size: 24px;
  color: #ffd700;
  font-weight: bold;
}

.menu-btn {
  padding: 15px 30px;
  font-size: 18px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  border: none;
  border-radius: 50px;
  font-weight: bold;
}
</style>
