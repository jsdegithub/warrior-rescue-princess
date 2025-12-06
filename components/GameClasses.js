// 音效系统
export class SoundManager {
  constructor() {
    this.enabled = true;
    this.audioContext = null;
    this.bgMusic = null; // 背景音乐
    this.bgMusicVolume = 0.4; // 背景音乐音量
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.log('Web Audio API not supported');
    }
  }

  // 播放背景音乐
  playBackgroundMusic(musicPath) {
    if (!this.enabled) return;

    try {
      // 使用 uni-app 的音频 API
      this.bgMusic = uni.createInnerAudioContext();
      this.bgMusic.src = musicPath;
      this.bgMusic.loop = true; // 循环播放
      this.bgMusic.volume = this.bgMusicVolume;
      this.bgMusic.autoplay = true;

      // 监听播放事件
      this.bgMusic.onPlay(() => {
        console.log('背景音乐开始播放');
      });

      this.bgMusic.onError((err) => {
        console.log('背景音乐播放出错:', err);
      });
    } catch (e) {
      console.log('背景音乐初始化失败:', e);
    }
  }

  // 停止背景音乐
  stopBackgroundMusic() {
    if (this.bgMusic) {
      this.bgMusic.stop();
      this.bgMusic.destroy();
      this.bgMusic = null;
    }
  }

  // 暂停背景音乐
  pauseBackgroundMusic() {
    if (this.bgMusic) {
      this.bgMusic.pause();
    }
  }

  // 恢复背景音乐
  resumeBackgroundMusic() {
    if (this.bgMusic) {
      this.bgMusic.play();
    }
  }

  // 设置背景音乐音量
  setBackgroundVolume(volume) {
    this.bgMusicVolume = Math.max(0, Math.min(1, volume));
    if (this.bgMusic) {
      this.bgMusic.volume = this.bgMusicVolume;
    }
  }

  playSound(frequency, duration, type = 'sine') {
    if (!this.enabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  jump() {
    this.playSound(400, 0.1, 'square');
  }

  attack() {
    this.playSound(600, 0.15, 'sawtooth');
  }

  hurt() {
    this.playSound(200, 0.2, 'sawtooth');
  }

  defeat() {
    this.playSound(150, 0.3, 'triangle');
  }

  victory() {
    if (!this.enabled || !this.audioContext) return;
    setTimeout(() => this.playSound(523, 0.2), 0);
    setTimeout(() => this.playSound(659, 0.2), 200);
    setTimeout(() => this.playSound(784, 0.4), 400);
  }
}

// 勇士类
export class Warrior {
  constructor(x, y, image, soundManager, sprites, imagePath) {
    this.x = x;
    this.y = y;
    this.width = 45;
    this.height = 60;
    this.image = image;
    this.imagePath = imagePath; // 头像路径
    this.soundManager = soundManager;
    this.sprites = sprites;

    // 精灵图路径（字符串）
    this.spritePaths = {
      idle: '/static/assets/MaleAdventurer/PNG/Poses/character_maleAdventurer_idle.png',
      jump: '/static/assets/MaleAdventurer/PNG/Poses/character_maleAdventurer_jump.png',
      walk: [
        '/static/assets/MaleAdventurer/PNG/Poses/character_maleAdventurer_walk0.png',
        '/static/assets/MaleAdventurer/PNG/Poses/character_maleAdventurer_walk1.png',
        '/static/assets/MaleAdventurer/PNG/Poses/character_maleAdventurer_walk2.png',
        '/static/assets/MaleAdventurer/PNG/Poses/character_maleAdventurer_walk3.png',
      ],
      attack: [
        '/static/assets/MaleAdventurer/PNG/Poses/character_maleAdventurer_attack0.png',
        '/static/assets/MaleAdventurer/PNG/Poses/character_maleAdventurer_attack1.png',
        '/static/assets/MaleAdventurer/PNG/Poses/character_maleAdventurer_attack2.png',
      ],
    };

    this.vx = 0;
    this.vy = 0;
    this.speed = 5;
    this.jumpPower = -15;
    this.gravity = 0.6;
    this.onGround = false;

    this.health = 3;
    this.isAttacking = false;
    this.attackTime = 0;
    this.isInvulnerable = false;
    this.invulnerableTime = 0;
    this.isFalling = false; // 是否正在掉落到陷阱中
    this.fallStartY = 0; // 开始掉落时的Y坐标

    this.direction = 1;
    this.walkFrame = 0;
    this.walkTime = 0;
    this.attackFrame = 0;

    // 装备系统
    this.hasSword = false; // 是否持有大宝剑
    this.swordSwingAngle = 0; // 剑挥动角度
  }

  // 装备大宝剑
  equipSword() {
    this.hasSword = true;
  }

  // 获取攻击范围（持剑时范围更大）
  getAttackRange() {
    return this.hasSword ? 100 : 60;
  }

  update(deltaTime, input, platforms, traps, levelWidth = Infinity) {
    // 如果正在掉落，禁用控制，只应用重力
    if (!this.isFalling) {
      this.vx = 0;
      if (input.left) {
        this.vx = -this.speed;
        this.direction = -1;
      }
      if (input.right) {
        this.vx = this.speed;
        this.direction = 1;
      }

      if (input.jump && this.onGround) {
        this.vy = this.jumpPower;
        this.onGround = false;
        this.soundManager.jump();
      }

      if (input.attack && !this.isAttacking) {
        this.isAttacking = true;
        this.attackTime = 300;
        this.soundManager.attack();
      }
    }

    if (this.attackTime > 0) {
      this.attackTime -= deltaTime;
      if (this.attackTime <= 0) {
        this.isAttacking = false;
      }
    }

    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= deltaTime;
      if (this.invulnerableTime <= 0) {
        this.isInvulnerable = false;
      }
    }

    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;

    // 限制勇士在关卡范围内（左边界为0，右边界为levelWidth）
    if (this.x < 0) {
      this.x = 0;
    }
    if (this.x + this.width > levelWidth) {
      this.x = levelWidth - this.width;
    }

    // 如果正在掉落，检查是否掉落到足够深度
    if (this.isFalling) {
      if (this.y > this.fallStartY + 150) {
        this.health = 0; // 掉落到足够深度后才判定死亡
      }
      return; // 掉落状态下不检测平台碰撞和陷阱
    }

    this.onGround = false;
    platforms.forEach((platform) => {
      if (this.checkPlatformCollision(platform)) {
        this.handlePlatformCollision(platform, traps);
      }
    });

    this.checkTraps(traps);

    if (this.vx !== 0 && this.onGround) {
      this.walkTime += deltaTime;
      if (this.walkTime > 100) {
        this.walkFrame = (this.walkFrame + 1) % 4;
        this.walkTime = 0;
      }
    } else {
      this.walkFrame = 0;
    }
  }

  checkTraps(traps) {
    traps.forEach((trap) => {
      if (trap.type === 'pit') {
        // 检查勇士是否在陷阱的水平范围内
        const warriorLeft = this.x;
        const warriorRight = this.x + this.width;

        // 勇士的大部分身体（超过70%）在陷阱范围内
        const overlapLeft = Math.max(warriorLeft, trap.x);
        const overlapRight = Math.min(warriorRight, trap.x + trap.width);
        const overlapWidth = Math.max(0, overlapRight - overlapLeft);
        const overlapRatio = overlapWidth / this.width;

        // 检查勇士的底部是否接近陷阱顶部（在陷阱上方60像素以内）
        const warriorBottom = this.y + this.height;
        const distanceToTrap = trap.y - warriorBottom;

        // 只有当勇士接近陷阱、正在下落、没有站在平台上、且大部分身体在陷阱上方时才触发
        if (
          overlapRatio > 0.7 &&
          !this.onGround &&
          this.vy > 0 &&
          !this.isFalling &&
          distanceToTrap < 60 &&
          distanceToTrap > -20
        ) {
          // 开始掉落
          this.isFalling = true;
          this.fallStartY = this.y;
          this.vx = 0; // 停止水平移动
        }
      } else if (trap.type === 'spike') {
        if (
          this.x + this.width > trap.x &&
          this.x < trap.x + trap.width &&
          this.y + this.height >= trap.y &&
          this.y + this.height <= trap.y + trap.height + 10 &&
          !this.isInvulnerable
        ) {
          this.takeDamage();
        }
      }
    });
  }

  checkPlatformCollision(platform) {
    return (
      this.x < platform.x + platform.width &&
      this.x + this.width > platform.x &&
      this.y < platform.y + platform.height &&
      this.y + this.height > platform.y
    );
  }

  handlePlatformCollision(platform, traps) {
    const prevY = this.y - this.vy;

    if (prevY + this.height <= platform.y && this.vy > 0) {
      // 如果是地面平台，检查是否在陷阱上方
      if (platform.type === 'ground') {
        const warriorLeft = this.x;
        const warriorRight = this.x + this.width;

        // 检查是否在任何坑陷阱上方
        for (const trap of traps) {
          if (trap.type === 'pit') {
            const overlapLeft = Math.max(warriorLeft, trap.x);
            const overlapRight = Math.min(warriorRight, trap.x + trap.width);
            const overlapWidth = Math.max(0, overlapRight - overlapLeft);
            const overlapRatio = overlapWidth / this.width;

            // 如果勇士超过70%在陷阱上方，不让他站在地面上，让他掉落
            if (overlapRatio > 0.7 && Math.abs(platform.y - trap.y) < 5) {
              return; // 不处理碰撞，让勇士继续下落
            }
          }
        }
      }

      // 正常的平台碰撞处理
      this.y = platform.y - this.height;
      this.vy = 0;
      this.onGround = true;
    }
  }

  checkCollision(enemy) {
    return (
      this.x < enemy.x + enemy.width &&
      this.x + this.width > enemy.x &&
      this.y < enemy.y + enemy.height &&
      this.y + this.height > enemy.y
    );
  }

  takeDamage() {
    this.health--;
    this.isInvulnerable = true;
    this.invulnerableTime = 2000;
    this.soundManager.hurt();
  }

  draw(ctx) {
    ctx.save();

    if (this.isInvulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    ctx.imageSmoothingEnabled = false;

    // 选择当前精灵图路径
    let currentSpritePath = this.spritePaths.idle;
    if (this.isAttacking) {
      const attackFrameIndex = Math.min(2, Math.floor((300 - this.attackTime) / 100));
      currentSpritePath = this.spritePaths.attack[attackFrameIndex] || this.spritePaths.idle;
    } else if (!this.onGround) {
      currentSpritePath = this.spritePaths.jump;
    } else if (this.vx !== 0) {
      const walkIndex = Math.floor(this.walkFrame / 2) % 4;
      currentSpritePath = this.spritePaths.walk[walkIndex] || this.spritePaths.idle;
    }

    if (this.direction === -1) {
      ctx.translate(this.x + this.width, 0);
      ctx.scale(-1, 1);
      ctx.translate(-this.x, 0);
    }

    // 绘制勇士身体（精灵图）
    // 先尝试使用精灵图，如果失败则使用简单矩形
    let spriteDrawn = false;
    if (currentSpritePath && typeof ctx.drawImage === 'function') {
      try {
        // 使用路径字符串绘制精灵图
        ctx.drawImage(
          currentSpritePath,
          this.x,
          this.y + 20, // 从颈部以下开始绘制
          this.width,
          this.height - 20
        );
        spriteDrawn = true;
      } catch (e) {
        // 如果精灵图绘制失败，使用默认矩形
        spriteDrawn = false;
      }
    }

    // 如果精灵图绘制失败，使用简单形状
    if (!spriteDrawn) {
      ctx.fillStyle = '#4169E1'; // 蓝色
      ctx.fillRect(this.x, this.y + 20, this.width, this.height - 20);

      // 绘制四肢简单线条
      ctx.strokeStyle = '#4169E1';
      ctx.lineWidth = 3;
      // 左臂
      ctx.beginPath();
      ctx.moveTo(this.x + 8, this.y + 28);
      ctx.lineTo(this.x + 4, this.y + 40);
      ctx.stroke();
      // 右臂
      ctx.beginPath();
      ctx.moveTo(this.x + 37, this.y + 28);
      ctx.lineTo(this.x + 41, this.y + 40);
      ctx.stroke();
    }

    // 绘制头部（圆形照片）
    const headCenterX = this.x + this.width / 2;
    const headCenterY = this.y + 12;
    const headRadius = 12;

    ctx.save();
    // 创建圆形裁剪区域
    ctx.beginPath();
    ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // 在圆形区域内绘制照片
    if (this.imagePath && typeof ctx.drawImage === 'function') {
      try {
        // 尝试直接使用路径绘制（uni-app 可能支持）
        ctx.drawImage(
          this.imagePath,
          headCenterX - headRadius,
          headCenterY - headRadius,
          headRadius * 2,
          headRadius * 2
        );
      } catch (e) {
        // 如果失败，绘制默认头部
        ctx.fillStyle = '#FFE4B5';
        ctx.fillRect(headCenterX - headRadius, headCenterY - headRadius, headRadius * 2, headRadius * 2);
      }
    } else {
      // 默认头部
      ctx.fillStyle = '#FFE4B5';
      ctx.fillRect(headCenterX - headRadius, headCenterY - headRadius, headRadius * 2, headRadius * 2);
    }
    ctx.restore();

    // 绘制头部边框
    ctx.beginPath();
    ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // 绘制大宝剑（如果已装备）
    if (this.hasSword) {
      this.drawSword(ctx);
    }
  }

  // 绘制大宝剑
  drawSword(ctx) {
    ctx.save();

    // 根据方向确定手的位置
    const handX = this.x + (this.direction === 1 ? this.width - 5 : 5);
    const handY = this.y + 35;

    // 计算剑的挥动角度（攻击时挥动）
    // 由于使用 scale(-1, 1) 翻转，两个方向的角度计算保持一致
    let swordAngle = -0.3; // 剑默认稍微向上倾斜
    if (this.isAttacking) {
      // 攻击时从上往下挥砍
      const swingProgress = (300 - this.attackTime) / 300;
      const swingAngle = Math.sin(swingProgress * Math.PI) * 2.5; // 挥砍幅度
      swordAngle += swingAngle;
    }

    ctx.translate(handX, handY);

    // 向左时需要水平翻转剑
    if (this.direction === -1) {
      ctx.scale(-1, 1);
    }

    ctx.rotate(swordAngle);

    // 剑柄
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-3, 0, 6, 15);

    // 剑柄装饰
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(-6, 12, 12, 4);

    // 剑身（使用纯色，兼容 uni-app canvas）
    ctx.fillStyle = '#C0C0C0';

    // 剑身形状（三角形剑尖）
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-5, -45);
    ctx.lineTo(0, -55);
    ctx.lineTo(5, -45);
    ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.fill();

    // 剑身高光区域
    ctx.fillStyle = '#E0E0E0';
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-2, -43);
    ctx.lineTo(0, -50);
    ctx.lineTo(2, -43);
    ctx.lineTo(1, 0);
    ctx.closePath();
    ctx.fill();

    // 剑身边缘高光
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(0, -50);
    ctx.stroke();

    // 剑身边框
    ctx.strokeStyle = '#696969';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-5, -45);
    ctx.lineTo(0, -55);
    ctx.lineTo(5, -45);
    ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.stroke();

    // 攻击时添加剑光特效
    if (this.isAttacking) {
      ctx.strokeStyle = 'rgba(255, 255, 100, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -55);
      ctx.lineTo(0, -70);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// 公主类
export class Princess {
  constructor(x, y, image, imagePath) {
    this.x = x;
    this.y = y;
    this.width = 45;
    this.height = 60;
    this.image = image;
    this.imagePath = imagePath;

    // 精灵图路径（字符串）
    this.spritePaths = {
      idle: '/static/assets/FemaleAdventurer/PNG/Poses/character_femaleAdventurer_idle.png',
      walk: [
        '/static/assets/FemaleAdventurer/PNG/Poses/character_femaleAdventurer_walk0.png',
        '/static/assets/FemaleAdventurer/PNG/Poses/character_femaleAdventurer_walk1.png',
        '/static/assets/FemaleAdventurer/PNG/Poses/character_femaleAdventurer_walk2.png',
        '/static/assets/FemaleAdventurer/PNG/Poses/character_femaleAdventurer_walk3.png',
      ],
    };

    // 公主动画状态
    this.walkFrame = 0;
    this.walkTime = 0;
    this.direction = 1;
  }

  drawPixel(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
  }

  // 简单的动画更新
  updateAnimation(deltaTime) {
    // 简单的待机动画
    this.walkTime += deltaTime;
    if (this.walkTime > 200) {
      this.walkFrame = (this.walkFrame + 1) % 4;
      this.walkTime = 0;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 选择当前精灵图（简单的待机动画）
    const walkIndex = Math.floor(this.walkFrame / 2) % 4;
    const currentSpritePath = this.spritePaths.walk[walkIndex] || this.spritePaths.idle;

    // 绘制公主身体（精灵图）
    let spriteDrawn = false;
    if (currentSpritePath && typeof ctx.drawImage === 'function') {
      try {
        // 使用路径字符串绘制精灵图
        ctx.drawImage(
          currentSpritePath,
          this.x,
          this.y + 20, // 从颈部以下开始绘制
          this.width,
          this.height - 20
        );
        spriteDrawn = true;
      } catch (e) {
        // 如果精灵图绘制失败，使用默认形状
        spriteDrawn = false;
      }
    }

    // 如果精灵图绘制失败，使用简单形状
    if (!spriteDrawn) {
      ctx.fillStyle = '#FF69B4'; // 粉色
      ctx.fillRect(this.x, this.y + 20, this.width, this.height - 20);
    }

    // 绘制头部（圆形照片 princess.jpg）
    const headCenterX = this.x + this.width / 2;
    const headCenterY = this.y + 12;
    const headRadius = 12;

    ctx.save();
    // 创建圆形裁剪区域
    ctx.beginPath();
    ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // 在圆形区域内绘制照片
    if (this.imagePath && typeof ctx.drawImage === 'function') {
      try {
        // 尝试直接使用路径绘制 princess.jpg
        ctx.drawImage(
          this.imagePath,
          headCenterX - headRadius,
          headCenterY - headRadius,
          headRadius * 2,
          headRadius * 2
        );
      } catch (e) {
        // 如果失败，绘制默认头部
        ctx.fillStyle = '#FFE4B5';
        ctx.fillRect(headCenterX - headRadius, headCenterY - headRadius, headRadius * 2, headRadius * 2);
      }
    } else {
      // 默认头部
      ctx.fillStyle = '#FFE4B5';
      ctx.fillRect(headCenterX - headRadius, headCenterY - headRadius, headRadius * 2, headRadius * 2);
    }
    ctx.restore();

    // 绘制头部边框
    ctx.beginPath();
    ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}

// 道具类
export class Item {
  constructor(x, y, type = 'sword') {
    this.x = x;
    this.y = y;
    this.width = 40;
    this.height = 40;
    this.type = type;
    this.collected = false;
    this.floatOffset = 0;
    this.floatTime = Math.random() * Math.PI * 2; // 随机起始相位
    this.glowIntensity = 0;
  }

  update(deltaTime) {
    if (this.collected) return;

    // 浮动动画
    this.floatTime += deltaTime * 0.003;
    this.floatOffset = Math.sin(this.floatTime) * 5;

    // 发光动画
    this.glowIntensity = (Math.sin(this.floatTime * 2) + 1) / 2;
  }

  draw(ctx) {
    if (this.collected) return;

    const drawY = this.y + this.floatOffset;

    if (this.type === 'sword') {
      this.drawSword(ctx, drawY);
    }
  }

  // 绘制大宝剑道具
  drawSword(ctx, drawY) {
    const centerX = this.x + this.width / 2;
    const centerY = drawY + this.height / 2;

    // 发光效果（使用多层圆形模拟径向渐变，兼容 uni-app canvas）
    const glowRadius = 25 + this.glowIntensity * 10;
    const glowAlpha = 0.15 + this.glowIntensity * 0.15;

    // 外层光晕
    ctx.fillStyle = `rgba(255, 215, 0, ${glowAlpha * 0.3})`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // 中层光晕
    ctx.fillStyle = `rgba(255, 215, 0, ${glowAlpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // 内层光晕
    ctx.fillStyle = `rgba(255, 215, 0, ${glowAlpha})`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-0.3); // 稍微倾斜

    // 剑柄
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-4, 5, 8, 18);

    // 剑柄装饰（护手）
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(-10, 2, 20, 5);

    // 宝石
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(0, 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 剑身（使用纯色，因为 uni-app 可能不支持 createLinearGradient）
    ctx.fillStyle = '#C0C0C0';

    // 剑身形状
    ctx.beginPath();
    ctx.moveTo(-6, 5);
    ctx.lineTo(-7, -30);
    ctx.lineTo(0, -40);
    ctx.lineTo(7, -30);
    ctx.lineTo(6, 5);
    ctx.closePath();
    ctx.fill();

    // 剑身高光区域
    ctx.fillStyle = '#E8E8E8';
    ctx.beginPath();
    ctx.moveTo(-2, 5);
    ctx.lineTo(-3, -28);
    ctx.lineTo(0, -35);
    ctx.lineTo(3, -28);
    ctx.lineTo(2, 5);
    ctx.closePath();
    ctx.fill();

    // 剑身中线高光
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -35);
    ctx.stroke();

    // 剑身边框
    ctx.strokeStyle = '#696969';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, 5);
    ctx.lineTo(-7, -30);
    ctx.lineTo(0, -40);
    ctx.lineTo(7, -30);
    ctx.lineTo(6, 5);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();

    // 提示文字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    // ctx.fillText('大宝剑', centerX, drawY + this.height + 12);
  }
}

// 平台类
export class Platform {
  constructor(x, y, width, height, type = 'platform') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;
  }

  draw(ctx) {
    if (this.type === 'ground') {
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(this.x, this.y, this.width, this.height);

      ctx.fillStyle = '#228B22';
      ctx.fillRect(this.x, this.y, this.width, 10);

      ctx.strokeStyle = '#006400';
      ctx.lineWidth = 2;
      for (let i = 0; i < this.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(this.x + i, this.y + 5);
        ctx.lineTo(this.x + i + 3, this.y);
        ctx.lineTo(this.x + i + 6, this.y + 5);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(this.x, this.y, this.width, this.height);

      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x, this.y, this.width, this.height);

      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 1;
      for (let i = 0; i < this.width; i += 30) {
        ctx.beginPath();
        ctx.moveTo(this.x + i, this.y);
        ctx.lineTo(this.x + i, this.y + this.height);
        ctx.stroke();
      }
    }
  }
}

// 敌人类
export class Enemy {
  constructor(x, y, type = 'patrol', minX = 0, maxX = 1000) {
    this.x = x;
    this.y = y;
    this.width = 45;
    this.height = 45;
    this.type = type;
    this.minX = minX;
    this.maxX = maxX;
    this.vx = type === 'fly' ? 2 : type === 'shooter' ? 0.5 : type === 'fly_shooter' ? 1.5 : 1;
    this.vy = 0;
    this.defeated = false;
    this.direction = 1;

    if (type === 'fly') {
      this.flyTime = 0;
      this.flyAmplitude = 50;
      this.startY = y;
    }

    // 射击怪物属性
    if (type === 'shooter') {
      this.shootCooldown = 0; // 射击冷却时间
      this.shootInterval = 2000; // 每 2 秒发射一次
      this.bullets = []; // 该怪物发射的子弹
    }

    // 飞行射击怪物属性（结合飞行和射击）
    if (type === 'fly_shooter') {
      this.flyTime = 0;
      this.flyAmplitude = 40;
      this.startY = y;
      this.shootCooldown = 0;
      this.shootInterval = 2500; // 每 2.5 秒发射一次
      this.bullets = [];
    }
  }

  update(deltaTime, warriorX = null, warriorY = null) {
    if (this.defeated) return;

    // 存储勇士位置（用于瞄准射击）
    this.targetX = warriorX;
    this.targetY = warriorY;

    if (this.type === 'patrol') {
      this.x += this.vx * this.direction;

      if (this.x <= this.minX || this.x >= this.maxX) {
        this.direction *= -1;
      }
    } else if (this.type === 'fly') {
      this.x += this.vx * this.direction;
      this.flyTime += deltaTime * 0.003;
      this.y = this.startY + Math.sin(this.flyTime) * this.flyAmplitude;

      if (this.x >= this.maxX || this.x <= this.minX) {
        this.direction *= -1;
      }
    } else if (this.type === 'shooter') {
      // 射击怪物：缓慢移动
      this.x += this.vx * this.direction;

      if (this.x <= this.minX || this.x >= this.maxX) {
        this.direction *= -1;
      }

      // 根据勇士位置调整面朝方向
      if (warriorX !== null) {
        this.direction = warriorX > this.x ? 1 : -1;
      }

      // 更新射击冷却
      this.shootCooldown -= deltaTime;
    } else if (this.type === 'fly_shooter') {
      // 飞行射击怪物：飞行 + 射击
      this.x += this.vx * this.direction;
      this.flyTime += deltaTime * 0.003;
      this.y = this.startY + Math.sin(this.flyTime) * this.flyAmplitude;

      if (this.x >= this.maxX || this.x <= this.minX) {
        this.direction *= -1;
      }

      // 根据勇士位置调整面朝方向（用于射击）
      if (warriorX !== null) {
        this.shootDirection = warriorX > this.x ? 1 : -1;
      } else {
        this.shootDirection = this.direction;
      }

      // 更新射击冷却
      this.shootCooldown -= deltaTime;
    }

    // 更新子弹
    if (this.bullets) {
      this.bullets.forEach((bullet) => bullet.update(deltaTime));
      // 移除失效的子弹
      this.bullets = this.bullets.filter((bullet) => bullet.active);
    }
  }

  // 射击方法 - 返回新创建的子弹
  shoot() {
    // 支持 shooter 和 fly_shooter 类型
    if ((this.type !== 'shooter' && this.type !== 'fly_shooter') || this.shootCooldown > 0 || this.defeated) {
      return null;
    }

    this.shootCooldown = this.shootInterval;

    // 确定射击方向
    const shootDir = this.type === 'fly_shooter' ? this.shootDirection || this.direction : this.direction;

    // 从怪物中心发射子弹
    const bulletX = shootDir === 1 ? this.x + this.width : this.x - 12;
    const bulletY = this.y + this.height / 2 - 4;

    // fly_shooter 的子弹速度稍快
    const bulletSpeed = this.type === 'fly_shooter' ? 5 : 4;

    // 计算垂直速度（fly_shooter 朝向勇士射击）
    let bulletVy = 0;
    if (this.type === 'fly_shooter' && this.targetX !== null && this.targetY !== null) {
      // 计算从怪物到勇士的方向向量
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        // 根据水平速度计算对应的垂直速度，使子弹朝向勇士
        // bulletVy / bulletSpeed = dy / |dx|
        const normalizedDy = dy / Math.abs(dx);
        bulletVy = normalizedDy * bulletSpeed;

        // 限制垂直速度，避免子弹太陡
        bulletVy = Math.max(-4, Math.min(4, bulletVy));
      }
    }

    return new Bullet(bulletX, bulletY, shootDir, bulletSpeed, bulletVy);
  }

  defeat() {
    this.defeated = true;
  }

  draw(ctx) {
    if (this.defeated) return;

    ctx.fillStyle = '#8B0000';

    // 射击怪物单独绘制
    if (this.type === 'shooter') {
      this.drawShooter(ctx);
      return;
    }

    // 飞行射击怪物单独绘制
    if (this.type === 'fly_shooter') {
      this.drawFlyShooter(ctx);
      return;
    }

    if (this.type === 'fly') {
      const centerX = this.x + this.width / 2;
      const centerY = this.y + this.height / 2;

      // 绘制椭圆身体（手动实现，因为 uni-app canvas 不支持 ellipse）
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(1.5, 1); // 水平拉伸来创建椭圆效果
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const wingFlap = Math.sin(Date.now() * 0.01) * 10;

      ctx.beginPath();
      ctx.moveTo(centerX - 5, centerY);
      ctx.quadraticCurveTo(centerX - 20, centerY - 15 + wingFlap, centerX - 25, centerY);
      ctx.quadraticCurveTo(centerX - 20, centerY + 5, centerX - 5, centerY + 5);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(centerX + 5, centerY);
      ctx.quadraticCurveTo(centerX + 20, centerY - 15 + wingFlap, centerX + 25, centerY);
      ctx.quadraticCurveTo(centerX + 20, centerY + 5, centerX + 5, centerY + 5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      ctx.arc(centerX - 5, centerY - 2, 2, 0, Math.PI * 2);
      ctx.arc(centerX + 5, centerY - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const centerX = this.x + this.width / 2;

      // 绘制圆角矩形（手动实现，因为 uni-app canvas 不支持 roundRect）
      const x = this.x + 8;
      const y = this.y + 10;
      const width = 30;
      const height = 30;
      const radius = 5;

      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(this.x + 12, this.y + 10);
      ctx.lineTo(this.x + 10, this.y);
      ctx.lineTo(this.x + 15, this.y + 10);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(this.x + 33, this.y + 10);
      ctx.lineTo(this.x + 35, this.y);
      ctx.lineTo(this.x + 30, this.y + 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(this.x + 17, this.y + 20, 5, 0, Math.PI * 2);
      ctx.arc(this.x + 28, this.y + 20, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(this.x + 17, this.y + 20, 3, 0, Math.PI * 2);
      ctx.arc(this.x + 28, this.y + 20, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, this.y + 28, 8, 0, Math.PI);
      ctx.stroke();
    }
  }

  // 绘制射击怪物
  drawShooter(ctx) {
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;

    // 身体（紫色魔法师风格）
    ctx.fillStyle = '#4B0082';
    const bodyX = this.x + 5;
    const bodyY = this.y + 10;
    const bodyW = 35;
    const bodyH = 35;
    const radius = 8;

    // 绘制圆角矩形身体
    ctx.beginPath();
    ctx.moveTo(bodyX + radius, bodyY);
    ctx.lineTo(bodyX + bodyW - radius, bodyY);
    ctx.quadraticCurveTo(bodyX + bodyW, bodyY, bodyX + bodyW, bodyY + radius);
    ctx.lineTo(bodyX + bodyW, bodyY + bodyH - radius);
    ctx.quadraticCurveTo(bodyX + bodyW, bodyY + bodyH, bodyX + bodyW - radius, bodyY + bodyH);
    ctx.lineTo(bodyX + radius, bodyY + bodyH);
    ctx.quadraticCurveTo(bodyX, bodyY + bodyH, bodyX, bodyY + bodyH - radius);
    ctx.lineTo(bodyX, bodyY + radius);
    ctx.quadraticCurveTo(bodyX, bodyY, bodyX + radius, bodyY);
    ctx.closePath();
    ctx.fill();

    // 魔法帽子
    ctx.fillStyle = '#2E0854';
    ctx.beginPath();
    ctx.moveTo(centerX - 15, this.y + 12);
    ctx.lineTo(centerX, this.y - 15);
    ctx.lineTo(centerX + 15, this.y + 12);
    ctx.closePath();
    ctx.fill();

    // 帽檐
    ctx.fillStyle = '#2E0854';
    ctx.beginPath();
    ctx.arc(centerX, this.y + 12, 18, Math.PI, 2 * Math.PI);
    ctx.fill();

    // 眼睛（发光效果）
    ctx.fillStyle = '#FF00FF';
    ctx.beginPath();
    ctx.arc(this.x + 15, this.y + 22, 4, 0, Math.PI * 2);
    ctx.arc(this.x + 30, this.y + 22, 4, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛内核
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(this.x + 15, this.y + 22, 2, 0, Math.PI * 2);
    ctx.arc(this.x + 30, this.y + 22, 2, 0, Math.PI * 2);
    ctx.fill();

    // 魔法杖/手臂（指向发射方向）
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (this.direction === 1) {
      ctx.moveTo(this.x + 35, this.y + 30);
      ctx.lineTo(this.x + 50, this.y + 25);
    } else {
      ctx.moveTo(this.x + 10, this.y + 30);
      ctx.lineTo(this.x - 5, this.y + 25);
    }
    ctx.stroke();

    // 魔法杖头部发光
    ctx.fillStyle = this.shootCooldown < 500 ? '#FF4500' : '#FFD700';
    ctx.beginPath();
    if (this.direction === 1) {
      ctx.arc(this.x + 52, this.y + 24, 5, 0, Math.PI * 2);
    } else {
      ctx.arc(this.x - 7, this.y + 24, 5, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // 绘制飞行射击怪物（龙形怪物）
  drawFlyShooter(ctx) {
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const shootDir = this.shootDirection || this.direction;

    // 翅膀扇动动画
    const wingFlap = Math.sin(Date.now() * 0.015) * 12;

    // 身体（深绿色龙形）
    ctx.fillStyle = '#006400';

    // 绘制椭圆身体
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(1.3, 1);
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 龙翼（左翼）
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.moveTo(centerX - 8, centerY - 5);
    ctx.quadraticCurveTo(centerX - 30, centerY - 25 + wingFlap, centerX - 35, centerY - 5);
    ctx.quadraticCurveTo(centerX - 25, centerY + 5, centerX - 8, centerY);
    ctx.closePath();
    ctx.fill();

    // 龙翼（右翼）
    ctx.beginPath();
    ctx.moveTo(centerX + 8, centerY - 5);
    ctx.quadraticCurveTo(centerX + 30, centerY - 25 + wingFlap, centerX + 35, centerY - 5);
    ctx.quadraticCurveTo(centerX + 25, centerY + 5, centerX + 8, centerY);
    ctx.closePath();
    ctx.fill();

    // 龙头
    ctx.fillStyle = '#006400';
    const headOffsetX = shootDir * 12;
    ctx.beginPath();
    ctx.arc(centerX + headOffsetX, centerY - 2, 10, 0, Math.PI * 2);
    ctx.fill();

    // 龙角
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(centerX + headOffsetX - 5, centerY - 10);
    ctx.lineTo(centerX + headOffsetX - 8, centerY - 20);
    ctx.lineTo(centerX + headOffsetX - 2, centerY - 12);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(centerX + headOffsetX + 5, centerY - 10);
    ctx.lineTo(centerX + headOffsetX + 8, centerY - 20);
    ctx.lineTo(centerX + headOffsetX + 2, centerY - 12);
    ctx.closePath();
    ctx.fill();

    // 眼睛（红色发光）
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(centerX + headOffsetX - 3, centerY - 5, 3, 0, Math.PI * 2);
    ctx.arc(centerX + headOffsetX + 3, centerY - 5, 3, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛内核
    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(centerX + headOffsetX - 3, centerY - 5, 1.5, 0, Math.PI * 2);
    ctx.arc(centerX + headOffsetX + 3, centerY - 5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 嘴巴/火焰喷口（指向射击方向）
    const mouthX = centerX + headOffsetX + shootDir * 10;
    const mouthY = centerY;

    // 嘴巴发光效果（即将发射时变亮）
    if (this.shootCooldown < 600) {
      ctx.fillStyle = 'rgba(255, 100, 0, 0.6)';
      ctx.beginPath();
      ctx.arc(mouthX, mouthY, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 火焰喷口
    ctx.fillStyle = this.shootCooldown < 400 ? '#FF4500' : '#FF8C00';
    ctx.beginPath();
    ctx.arc(mouthX, mouthY, 4, 0, Math.PI * 2);
    ctx.fill();

    // 尾巴
    ctx.strokeStyle = '#006400';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX - shootDir * 15, centerY + 5);
    ctx.quadraticCurveTo(centerX - shootDir * 25, centerY + 15, centerX - shootDir * 30, centerY + 5);
    ctx.stroke();

    // 尾巴尖
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(centerX - shootDir * 30, centerY + 5);
    ctx.lineTo(centerX - shootDir * 38, centerY + 2);
    ctx.lineTo(centerX - shootDir * 35, centerY + 10);
    ctx.closePath();
    ctx.fill();
  }
}

// 子弹类
export class Bullet {
  constructor(x, y, direction, speed = 5, vy = 0) {
    this.x = x;
    this.y = y;
    this.width = 12;
    this.height = 8;
    this.direction = direction; // 1 向右, -1 向左
    this.speed = speed;
    this.vy = vy; // 垂直速度（用于飞龙朝向勇士射击）
    this.active = true;
  }

  update(deltaTime) {
    if (!this.active) return;
    this.x += this.speed * this.direction;
    this.y += this.vy;
  }

  // 检测是否超出屏幕范围
  isOutOfBounds(cameraX, screenWidth) {
    return this.x < cameraX - 100 || this.x > cameraX + screenWidth + 100;
  }

  draw(ctx) {
    if (!this.active) return;

    // 绘制火球/能量球样式的子弹
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;

    // 外发光效果
    ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
    ctx.fill();

    // 子弹主体（火焰色渐变效果）
    ctx.fillStyle = '#FF4500';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();

    // 子弹核心
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();

    // 尾焰效果
    ctx.fillStyle = 'rgba(255, 69, 0, 0.5)';
    const tailX = centerX - this.direction * 8;
    ctx.beginPath();
    ctx.moveTo(centerX - this.direction * 4, centerY);
    ctx.lineTo(tailX, centerY - 4);
    ctx.lineTo(tailX - this.direction * 4, centerY);
    ctx.lineTo(tailX, centerY + 4);
    ctx.closePath();
    ctx.fill();
  }
}

// 陷阱类
export class Trap {
  constructor(x, y, width, height, type = 'spike') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;
  }

  draw(ctx) {
    if (this.type === 'pit') {
      // 底部深色
      ctx.fillStyle = '#000000';
      ctx.fillRect(this.x, this.y, this.width, this.height);

      // 顶部稍浅（模拟渐变效果，兼容 uni-app canvas）
      ctx.fillStyle = '#222222';
      ctx.fillRect(this.x, this.y, this.width, this.height * 0.3);

      ctx.fillStyle = '#111111';
      ctx.fillRect(this.x, this.y + this.height * 0.3, this.width, this.height * 0.3);
    } else if (this.type === 'spike') {
      ctx.fillStyle = '#696969';
      ctx.fillRect(this.x, this.y + this.height - 5, this.width, 5);

      ctx.fillStyle = '#A9A9A9';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;

      const spikeCount = Math.floor(this.width / 25);
      for (let i = 0; i < spikeCount; i++) {
        ctx.beginPath();
        ctx.moveTo(this.x + i * 25, this.y + this.height);
        ctx.lineTo(this.x + i * 25 + 12, this.y);
        ctx.lineTo(this.x + i * 25 + 25, this.y + this.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}
