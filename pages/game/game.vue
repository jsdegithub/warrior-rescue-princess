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
import {SoundManager, Warrior, Princess, Platform, Enemy, Trap} from '@/components/GameClasses.js';

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
      hearts: [],
      cameraX: 0,

      levelWidth: 8000,

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

      // 地面平台
      this.platforms.push(new Platform(0, this.height - 50, this.levelWidth, 50, 'ground'));

      // 第一区域：起始区（0-1500）
      this.platforms.push(new Platform(200, this.height - 150, 200, 20, 'platform'));
      this.platforms.push(new Platform(450, this.height - 200, 150, 20, 'platform'));
      this.platforms.push(new Platform(700, this.height - 250, 180, 20, 'platform'));
      this.platforms.push(new Platform(950, this.height - 180, 160, 20, 'platform'));
      this.platforms.push(new Platform(1200, this.height - 220, 200, 20, 'platform'));

      // 第二区域：中间挑战区（1500-3500）
      for (let i = 0; i < 10; i++) {
        const x = 1500 + i * 200;
        const y = this.height - 150 - Math.sin(i * 0.6) * 120;
        this.platforms.push(new Platform(x, y, 160, 20, 'platform'));
      }

      // 第三区域：高空区（3500-5500）
      this.platforms.push(new Platform(3600, this.height - 300, 200, 20, 'platform'));
      this.platforms.push(new Platform(3900, this.height - 350, 180, 20, 'platform'));
      this.platforms.push(new Platform(4200, this.height - 280, 200, 20, 'platform'));
      this.platforms.push(new Platform(4500, this.height - 320, 160, 20, 'platform'));
      this.platforms.push(new Platform(4800, this.height - 250, 200, 20, 'platform'));
      this.platforms.push(new Platform(5100, this.height - 300, 180, 20, 'platform'));

      // 第四区域：最终挑战区（5500-7500）
      for (let i = 0; i < 8; i++) {
        const x = 5500 + i * 250;
        const y = this.height - 180 - Math.cos(i * 0.5) * 100;
        this.platforms.push(new Platform(x, y, 170, 20, 'platform'));
      }

      // 终点区域平台
      this.platforms.push(new Platform(7500, this.height - 150, 300, 20, 'platform'));
      this.platforms.push(new Platform(7700, this.height - 100, 300, 20, 'platform'));
    },

    createEnemies() {
      this.enemies = [];

      // 第一区域敌人（0-1500）
      this.enemies.push(new Enemy(500, this.height - 100, 'patrol', 400, 700));
      this.enemies.push(new Enemy(900, this.height - 100, 'patrol', 750, 1100));
      this.enemies.push(new Enemy(1100, this.height - 280, 'fly', 900, 1300));

      // 第二区域敌人（1500-3500）
      this.enemies.push(new Enemy(1600, this.height - 100, 'patrol', 1450, 1800));
      this.enemies.push(new Enemy(2100, this.height - 100, 'patrol', 1900, 2300));
      this.enemies.push(new Enemy(2600, this.height - 100, 'patrol', 2400, 2800));
      this.enemies.push(new Enemy(1900, this.height - 350, 'fly', 1700, 2200));
      this.enemies.push(new Enemy(2900, this.height - 320, 'fly', 2700, 3100));

      // 第三区域敌人（3500-5500）
      this.enemies.push(new Enemy(3700, this.height - 100, 'patrol', 3500, 3900));
      this.enemies.push(new Enemy(4300, this.height - 100, 'patrol', 4100, 4500));
      this.enemies.push(new Enemy(4000, this.height - 400, 'fly', 3800, 4200));
      this.enemies.push(new Enemy(4700, this.height - 350, 'fly', 4500, 4900));

      // 第四区域敌人（5500-7500）
      this.enemies.push(new Enemy(5700, this.height - 100, 'patrol', 5500, 5900));
      this.enemies.push(new Enemy(6200, this.height - 100, 'patrol', 6000, 6400));
      this.enemies.push(new Enemy(6700, this.height - 100, 'patrol', 6500, 6900));
      this.enemies.push(new Enemy(6000, this.height - 350, 'fly', 5800, 6300));
      this.enemies.push(new Enemy(6900, this.height - 380, 'fly', 6700, 7200));

      // 终点区域守卫
      this.enemies.push(new Enemy(7300, this.height - 100, 'patrol', 7100, 7500));
    },

    createTraps() {
      this.traps = [];

      // 第一区域陷阱
      this.traps.push(new Trap(650, this.height - 50, 180, 100, 'pit'));
      this.traps.push(new Trap(1050, this.height - 70, 120, 20, 'spike'));

      // 第二区域陷阱
      this.traps.push(new Trap(1850, this.height - 70, 150, 20, 'spike'));
      this.traps.push(new Trap(2300, this.height - 50, 200, 100, 'pit'));
      this.traps.push(new Trap(2750, this.height - 70, 130, 20, 'spike'));
      this.traps.push(new Trap(3150, this.height - 50, 180, 100, 'pit'));

      // 第三区域陷阱
      this.traps.push(new Trap(3850, this.height - 70, 150, 20, 'spike'));
      this.traps.push(new Trap(4350, this.height - 50, 200, 100, 'pit'));
      this.traps.push(new Trap(4850, this.height - 70, 140, 20, 'spike'));
      this.traps.push(new Trap(5250, this.height - 50, 180, 100, 'pit'));

      // 第四区域陷阱
      this.traps.push(new Trap(5850, this.height - 70, 150, 20, 'spike'));
      this.traps.push(new Trap(6350, this.height - 50, 180, 100, 'pit'));
      this.traps.push(new Trap(6800, this.height - 70, 160, 20, 'spike'));
      this.traps.push(new Trap(7100, this.height - 50, 150, 100, 'pit'));
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

        this.enemies.forEach((enemy) => enemy.update(deltaTime));

        this.enemies.forEach((enemy) => {
          if (this.warrior.checkCollision(enemy) && !enemy.defeated) {
            if (this.warrior.vy > 0 && this.warrior.y < enemy.y) {
              enemy.defeat();
              this.warrior.vy = -8;
              this.soundManager.defeat();
            } else if (!this.warrior.isInvulnerable) {
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
      if (this.enemies.length > 0) {
        this.enemies.forEach((enemy) => enemy.draw(this.ctx));
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
