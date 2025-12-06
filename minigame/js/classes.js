/**
 * 游戏类 - 微信小游戏版
 * 包含所有游戏实体：勇士、公主、平台、敌人、陷阱、子弹、道具
 */

// 勇士类
export class Warrior {
  constructor(x, y, soundManager) {
    this.x = x;
    this.y = y;
    this.width = 45;
    this.height = 60;
    this.soundManager = soundManager;

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
    this.isFalling = false;
    this.fallStartY = 0;

    this.direction = 1;
    this.walkFrame = 0;
    this.walkTime = 0;
    this.attackFrame = 0;

    // 装备系统
    this.hasSword = false;
    this.swordSwingAngle = 0;

    // 精灵图
    this.sprites = {
      idle: null,
      jump: null,
      walk: [],
      attack: [],
    };
    this.spritesLoaded = false;
    this.loadSprites();
  }

  // 加载精灵图
  loadSprites() {
    const basePath = 'images/MaleAdventurer/';

    // 加载待机精灵
    this.sprites.idle = wx.createImage();
    this.sprites.idle.src = basePath + 'character_maleAdventurer_idle.png';

    // 加载跳跃精灵
    this.sprites.jump = wx.createImage();
    this.sprites.jump.src = basePath + 'character_maleAdventurer_jump.png';

    // 加载行走精灵
    for (let i = 0; i < 4; i++) {
      const img = wx.createImage();
      img.src = basePath + `character_maleAdventurer_walk${i}.png`;
      this.sprites.walk.push(img);
    }

    // 加载攻击精灵
    for (let i = 0; i < 3; i++) {
      const img = wx.createImage();
      img.src = basePath + `character_maleAdventurer_attack${i}.png`;
      this.sprites.attack.push(img);
    }

    // 检查加载完成
    this.sprites.idle.onload = () => this.checkSpritesLoaded();
  }

  checkSpritesLoaded() {
    if (this.sprites.idle.complete) {
      this.spritesLoaded = true;
    }
  }

  equipSword() {
    this.hasSword = true;
  }

  getAttackRange() {
    return 60;
  }

  getSwordHitbox() {
    if (!this.hasSword || !this.isAttacking) {
      return null;
    }

    const handX = this.x + (this.direction === 1 ? this.width - 5 : 5);
    const handY = this.y + 35;

    let swordAngle = -0.3;
    const swingProgress = (300 - this.attackTime) / 300;
    const swingAngle = Math.sin(swingProgress * Math.PI) * 2.5;
    swordAngle += swingAngle;

    const swordLength = 60;
    const swordWidth = 20;

    const actualAngle = this.direction === 1 ? swordAngle - Math.PI / 2 : Math.PI / 2 - swordAngle;

    const tipX = handX + Math.cos(actualAngle) * swordLength * this.direction;
    const tipY = handY + Math.sin(actualAngle) * swordLength;

    const minX = Math.min(handX, tipX) - swordWidth / 2;
    const maxX = Math.max(handX, tipX) + swordWidth / 2;
    const minY = Math.min(handY, tipY) - swordWidth / 2;
    const maxY = Math.max(handY, tipY) + swordWidth / 2;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  update(deltaTime, input, platforms, traps, levelWidth = Infinity) {
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

    if (this.x < 0) this.x = 0;
    if (this.x + this.width > levelWidth) this.x = levelWidth - this.width;

    if (this.isFalling) {
      if (this.y > this.fallStartY + 150) {
        this.health = 0;
      }
      return;
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
        const warriorLeft = this.x;
        const warriorRight = this.x + this.width;

        const overlapLeft = Math.max(warriorLeft, trap.x);
        const overlapRight = Math.min(warriorRight, trap.x + trap.width);
        const overlapWidth = Math.max(0, overlapRight - overlapLeft);
        const overlapRatio = overlapWidth / this.width;

        const warriorBottom = this.y + this.height;
        const distanceToTrap = trap.y - warriorBottom;

        if (
          overlapRatio > 0.7 &&
          !this.onGround &&
          this.vy > 0 &&
          !this.isFalling &&
          distanceToTrap < 60 &&
          distanceToTrap > -20
        ) {
          this.isFalling = true;
          this.fallStartY = this.y;
          this.vx = 0;
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
      if (platform.type === 'ground') {
        const warriorLeft = this.x;
        const warriorRight = this.x + this.width;

        for (const trap of traps) {
          if (trap.type === 'pit') {
            const overlapLeft = Math.max(warriorLeft, trap.x);
            const overlapRight = Math.min(warriorRight, trap.x + trap.width);
            const overlapWidth = Math.max(0, overlapRight - overlapLeft);
            const overlapRatio = overlapWidth / this.width;

            if (overlapRatio > 0.7 && Math.abs(platform.y - trap.y) < 5) {
              return;
            }
          }
        }
      }

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

    // 选择当前精灵图
    let currentSprite = this.sprites.idle;
    if (this.isAttacking) {
      const attackFrameIndex = Math.min(2, Math.floor((300 - this.attackTime) / 100));
      currentSprite = this.sprites.attack[attackFrameIndex] || this.sprites.idle;
    } else if (!this.onGround) {
      currentSprite = this.sprites.jump || this.sprites.idle;
    } else if (this.vx !== 0) {
      const walkIndex = Math.floor(this.walkFrame / 2) % 4;
      currentSprite = this.sprites.walk[walkIndex] || this.sprites.idle;
    }

    // 方向翻转
    if (this.direction === -1) {
      ctx.translate(this.x + this.width, 0);
      ctx.scale(-1, 1);
      ctx.translate(-this.x, 0);
    }

    // 尝试绘制精灵图
    let spriteDrawn = false;
    if (currentSprite && currentSprite.complete && currentSprite.width > 0) {
      try {
        ctx.drawImage(currentSprite, this.x, this.y, this.width, this.height);
        spriteDrawn = true;
      } catch (e) {
        spriteDrawn = false;
      }
    }

    // 如果精灵图绘制失败，使用简单图形
    if (!spriteDrawn) {
      // 身体
      ctx.fillStyle = '#4169E1';
      ctx.fillRect(this.x + 8, this.y + 20, this.width - 16, this.height - 25);

      // 头部
      const headCenterX = this.x + this.width / 2;
      const headCenterY = this.y + 14;
      const headRadius = 12;

      ctx.fillStyle = '#FFE4B5';
      ctx.beginPath();
      ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
      ctx.fill();

      // 头发
      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.arc(headCenterX, headCenterY - 4, headRadius, Math.PI, 2 * Math.PI);
      ctx.fill();

      // 眼睛
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(headCenterX - 4, headCenterY - 1, 2, 0, Math.PI * 2);
      ctx.arc(headCenterX + 4, headCenterY - 1, 2, 0, Math.PI * 2);
      ctx.fill();

      // 嘴巴
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(headCenterX, headCenterY + 4, 3, 0, Math.PI);
      ctx.stroke();

      // 手臂
      ctx.strokeStyle = '#FFE4B5';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(this.x + 8, this.y + 28);
      ctx.lineTo(this.x + 2, this.y + 42);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.x + this.width - 8, this.y + 28);
      ctx.lineTo(this.x + this.width - 2, this.y + 42);
      ctx.stroke();

      // 腿
      ctx.strokeStyle = '#4169E1';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.x + 15, this.y + this.height - 5);
      ctx.lineTo(this.x + 12, this.y + this.height + 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.x + this.width - 15, this.y + this.height - 5);
      ctx.lineTo(this.x + this.width - 12, this.y + this.height + 5);
      ctx.stroke();
    }

    ctx.restore();

    // 绘制大宝剑
    if (this.hasSword) {
      this.drawSword(ctx);
    }
  }

  drawSword(ctx) {
    ctx.save();

    const handX = this.x + (this.direction === 1 ? this.width - 5 : 5);
    const handY = this.y + 35;

    let swordAngle = -0.3;
    if (this.isAttacking) {
      const swingProgress = (300 - this.attackTime) / 300;
      const swingAngle = Math.sin(swingProgress * Math.PI) * 2.5;
      swordAngle += swingAngle;
    }

    ctx.translate(handX, handY);

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

    // 剑身
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-5, -45);
    ctx.lineTo(0, -55);
    ctx.lineTo(5, -45);
    ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.fill();

    // 剑身高光
    ctx.fillStyle = '#E0E0E0';
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-2, -43);
    ctx.lineTo(0, -50);
    ctx.lineTo(2, -43);
    ctx.lineTo(1, 0);
    ctx.closePath();
    ctx.fill();

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

    // 攻击特效
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
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 45;
    this.height = 60;
    this.walkFrame = 0;
    this.walkTime = 0;
    this.direction = 1;

    // 精灵图
    this.sprites = {
      idle: null,
      walk: [],
    };
    this.spritesLoaded = false;
    this.loadSprites();
  }

  // 加载精灵图
  loadSprites() {
    const basePath = 'images/FemaleAdventurer/';

    // 加载待机精灵
    this.sprites.idle = wx.createImage();
    this.sprites.idle.src = basePath + 'character_femaleAdventurer_idle.png';

    // 加载行走精灵
    for (let i = 0; i < 4; i++) {
      const img = wx.createImage();
      img.src = basePath + `character_femaleAdventurer_walk${i}.png`;
      this.sprites.walk.push(img);
    }

    this.sprites.idle.onload = () => {
      this.spritesLoaded = true;
    };
  }

  updateAnimation(deltaTime) {
    this.walkTime += deltaTime;
    if (this.walkTime > 200) {
      this.walkFrame = (this.walkFrame + 1) % 4;
      this.walkTime = 0;
    }
  }

  draw(ctx) {
    ctx.save();

    // 选择当前精灵图（简单的待机/行走动画）
    const walkIndex = Math.floor(this.walkFrame / 2) % 4;
    let currentSprite = this.sprites.walk[walkIndex] || this.sprites.idle;

    // 尝试绘制精灵图
    let spriteDrawn = false;
    if (currentSprite && currentSprite.complete && currentSprite.width > 0) {
      try {
        ctx.drawImage(currentSprite, this.x, this.y, this.width, this.height);
        spriteDrawn = true;
      } catch (e) {
        spriteDrawn = false;
      }
    }

    // 如果精灵图绘制失败，使用简单图形
    if (!spriteDrawn) {
      // 绘制公主身体（裙子）
      ctx.fillStyle = '#FF69B4';

      // 上半身
      ctx.fillRect(this.x + 10, this.y + 20, this.width - 20, 20);

      // 裙子（梯形）
      ctx.beginPath();
      ctx.moveTo(this.x + 5, this.y + 40);
      ctx.lineTo(this.x - 2, this.y + this.height);
      ctx.lineTo(this.x + this.width + 2, this.y + this.height);
      ctx.lineTo(this.x + this.width - 5, this.y + 40);
      ctx.closePath();
      ctx.fill();

      // 绘制头部
      const headCenterX = this.x + this.width / 2;
      const headCenterY = this.y + 14;
      const headRadius = 12;

      ctx.fillStyle = '#FFE4B5';
      ctx.beginPath();
      ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
      ctx.fill();

      // 头发（长发）
      ctx.fillStyle = '#DEB887';
      ctx.beginPath();
      ctx.arc(headCenterX, headCenterY - 2, headRadius + 2, Math.PI * 0.8, Math.PI * 2.2);
      ctx.fill();
      // 长发垂下
      ctx.fillRect(this.x + 2, headCenterY, 6, 25);
      ctx.fillRect(this.x + this.width - 8, headCenterY, 6, 25);

      // 皇冠
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(headCenterX - 8, headCenterY - 10);
      ctx.lineTo(headCenterX - 6, headCenterY - 18);
      ctx.lineTo(headCenterX - 3, headCenterY - 12);
      ctx.lineTo(headCenterX, headCenterY - 20);
      ctx.lineTo(headCenterX + 3, headCenterY - 12);
      ctx.lineTo(headCenterX + 6, headCenterY - 18);
      ctx.lineTo(headCenterX + 8, headCenterY - 10);
      ctx.closePath();
      ctx.fill();

      // 皇冠宝石
      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      ctx.arc(headCenterX, headCenterY - 15, 2, 0, Math.PI * 2);
      ctx.fill();

      // 眼睛
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(headCenterX - 4, headCenterY - 1, 2, 0, Math.PI * 2);
      ctx.arc(headCenterX + 4, headCenterY - 1, 2, 0, Math.PI * 2);
      ctx.fill();

      // 睫毛
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(headCenterX - 6, headCenterY - 3);
      ctx.lineTo(headCenterX - 7, headCenterY - 5);
      ctx.moveTo(headCenterX + 6, headCenterY - 3);
      ctx.lineTo(headCenterX + 7, headCenterY - 5);
      ctx.stroke();

      // 嘴巴（微笑）
      ctx.strokeStyle = '#FF6B6B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(headCenterX, headCenterY + 4, 3, 0, Math.PI);
      ctx.stroke();

      // 腮红
      ctx.fillStyle = 'rgba(255, 182, 193, 0.5)';
      ctx.beginPath();
      ctx.arc(headCenterX - 8, headCenterY + 2, 3, 0, Math.PI * 2);
      ctx.arc(headCenterX + 8, headCenterY + 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

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
    this.floatTime = Math.random() * Math.PI * 2;
    this.glowIntensity = 0;
  }

  update(deltaTime) {
    if (this.collected) return;

    this.floatTime += deltaTime * 0.003;
    this.floatOffset = Math.sin(this.floatTime) * 5;
    this.glowIntensity = (Math.sin(this.floatTime * 2) + 1) / 2;
  }

  draw(ctx) {
    if (this.collected) return;

    const drawY = this.y + this.floatOffset;

    if (this.type === 'sword') {
      this.drawSword(ctx, drawY);
    }
  }

  drawSword(ctx, drawY) {
    const centerX = this.x + this.width / 2;
    const centerY = drawY + this.height / 2;

    // 发光效果
    const glowRadius = 25 + this.glowIntensity * 10;
    const glowAlpha = 0.15 + this.glowIntensity * 0.15;

    ctx.fillStyle = `rgba(255, 215, 0, ${glowAlpha * 0.3})`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 215, 0, ${glowAlpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 215, 0, ${glowAlpha})`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-0.3);

    // 剑柄
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-4, 5, 8, 18);

    // 护手
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(-10, 2, 20, 5);

    // 宝石
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(0, 12, 4, 0, Math.PI * 2);
    ctx.fill();

    // 剑身
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath();
    ctx.moveTo(-6, 5);
    ctx.lineTo(-7, -30);
    ctx.lineTo(0, -40);
    ctx.lineTo(7, -30);
    ctx.lineTo(6, 5);
    ctx.closePath();
    ctx.fill();

    // 剑身高光
    ctx.fillStyle = '#E8E8E8';
    ctx.beginPath();
    ctx.moveTo(-2, 5);
    ctx.lineTo(-3, -28);
    ctx.lineTo(0, -35);
    ctx.lineTo(3, -28);
    ctx.lineTo(2, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
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

      // 草
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

      // 木纹
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

    if (type === 'shooter') {
      this.shootCooldown = 0;
      this.shootInterval = 2000;
      this.bullets = [];
    }

    if (type === 'fly_shooter') {
      this.flyTime = 0;
      this.flyAmplitude = 40;
      this.startY = y;
      this.shootCooldown = 0;
      this.shootInterval = 2500;
      this.bullets = [];
    }
  }

  update(deltaTime, warriorX = null, warriorY = null) {
    if (this.defeated) return;

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
      this.x += this.vx * this.direction;
      if (this.x <= this.minX || this.x >= this.maxX) {
        this.direction *= -1;
      }
      if (warriorX !== null) {
        this.direction = warriorX > this.x ? 1 : -1;
      }
      this.shootCooldown -= deltaTime;
    } else if (this.type === 'fly_shooter') {
      this.x += this.vx * this.direction;
      this.flyTime += deltaTime * 0.003;
      this.y = this.startY + Math.sin(this.flyTime) * this.flyAmplitude;
      if (this.x >= this.maxX || this.x <= this.minX) {
        this.direction *= -1;
      }
      if (warriorX !== null) {
        this.shootDirection = warriorX > this.x ? 1 : -1;
      } else {
        this.shootDirection = this.direction;
      }
      this.shootCooldown -= deltaTime;
    }

    if (this.bullets) {
      this.bullets.forEach((bullet) => bullet.update(deltaTime));
      this.bullets = this.bullets.filter((bullet) => bullet.active);
    }
  }

  shoot() {
    if ((this.type !== 'shooter' && this.type !== 'fly_shooter') || this.shootCooldown > 0 || this.defeated) {
      return null;
    }

    this.shootCooldown = this.shootInterval;

    const shootDir = this.type === 'fly_shooter' ? this.shootDirection || this.direction : this.direction;
    const bulletX = shootDir === 1 ? this.x + this.width : this.x - 12;
    const bulletY = this.y + this.height / 2 - 4;
    const bulletSpeed = this.type === 'fly_shooter' ? 5 : 4;

    let bulletVy = 0;
    if (this.type === 'fly_shooter' && this.targetX !== null && this.targetY !== null) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        const normalizedDy = dy / Math.abs(dx);
        bulletVy = normalizedDy * bulletSpeed;
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

    if (this.type === 'shooter') {
      this.drawShooter(ctx);
      return;
    }

    if (this.type === 'fly_shooter') {
      this.drawFlyShooter(ctx);
      return;
    }

    if (this.type === 'fly') {
      const centerX = this.x + this.width / 2;
      const centerY = this.y + this.height / 2;

      // 身体
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(1.5, 1);
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 翅膀
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

      // 眼睛
      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      ctx.arc(centerX - 5, centerY - 2, 2, 0, Math.PI * 2);
      ctx.arc(centerX + 5, centerY - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 巡逻怪物
      const centerX = this.x + this.width / 2;
      const x = this.x + 8;
      const y = this.y + 10;
      const width = 30;
      const height = 30;
      const radius = 5;

      // 圆角矩形身体
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

      // 角
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

      // 眼睛
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

      // 嘴巴
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, this.y + 28, 8, 0, Math.PI);
      ctx.stroke();
    }
  }

  drawShooter(ctx) {
    const centerX = this.x + this.width / 2;

    // 身体
    ctx.fillStyle = '#4B0082';
    const bodyX = this.x + 5;
    const bodyY = this.y + 10;
    const bodyW = 35;
    const bodyH = 35;
    const radius = 8;

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

    // 帽子
    ctx.fillStyle = '#2E0854';
    ctx.beginPath();
    ctx.moveTo(centerX - 15, this.y + 12);
    ctx.lineTo(centerX, this.y - 15);
    ctx.lineTo(centerX + 15, this.y + 12);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, this.y + 12, 18, Math.PI, 2 * Math.PI);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#FF00FF';
    ctx.beginPath();
    ctx.arc(this.x + 15, this.y + 22, 4, 0, Math.PI * 2);
    ctx.arc(this.x + 30, this.y + 22, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(this.x + 15, this.y + 22, 2, 0, Math.PI * 2);
    ctx.arc(this.x + 30, this.y + 22, 2, 0, Math.PI * 2);
    ctx.fill();

    // 魔法杖
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

    ctx.fillStyle = this.shootCooldown < 500 ? '#FF4500' : '#FFD700';
    ctx.beginPath();
    if (this.direction === 1) {
      ctx.arc(this.x + 52, this.y + 24, 5, 0, Math.PI * 2);
    } else {
      ctx.arc(this.x - 7, this.y + 24, 5, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  drawFlyShooter(ctx) {
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const shootDir = this.shootDirection || this.direction;

    const wingFlap = Math.sin(Date.now() * 0.015) * 12;

    // 身体
    ctx.fillStyle = '#006400';
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(1.3, 1);
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 翅膀
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.moveTo(centerX - 8, centerY - 5);
    ctx.quadraticCurveTo(centerX - 30, centerY - 25 + wingFlap, centerX - 35, centerY - 5);
    ctx.quadraticCurveTo(centerX - 25, centerY + 5, centerX - 8, centerY);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(centerX + 8, centerY - 5);
    ctx.quadraticCurveTo(centerX + 30, centerY - 25 + wingFlap, centerX + 35, centerY - 5);
    ctx.quadraticCurveTo(centerX + 25, centerY + 5, centerX + 8, centerY);
    ctx.closePath();
    ctx.fill();

    // 头
    ctx.fillStyle = '#006400';
    const headOffsetX = shootDir * 12;
    ctx.beginPath();
    ctx.arc(centerX + headOffsetX, centerY - 2, 10, 0, Math.PI * 2);
    ctx.fill();

    // 角
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

    // 眼睛
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(centerX + headOffsetX - 3, centerY - 5, 3, 0, Math.PI * 2);
    ctx.arc(centerX + headOffsetX + 3, centerY - 5, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(centerX + headOffsetX - 3, centerY - 5, 1.5, 0, Math.PI * 2);
    ctx.arc(centerX + headOffsetX + 3, centerY - 5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 火焰喷口
    const mouthX = centerX + headOffsetX + shootDir * 10;
    const mouthY = centerY;

    if (this.shootCooldown < 600) {
      ctx.fillStyle = 'rgba(255, 100, 0, 0.6)';
      ctx.beginPath();
      ctx.arc(mouthX, mouthY, 8, 0, Math.PI * 2);
      ctx.fill();
    }

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
  }
}

// 子弹类
export class Bullet {
  constructor(x, y, direction, speed = 5, vy = 0) {
    this.x = x;
    this.y = y;
    this.width = 12;
    this.height = 8;
    this.direction = direction;
    this.speed = speed;
    this.vy = vy;
    this.active = true;
  }

  update(deltaTime) {
    if (!this.active) return;
    this.x += this.speed * this.direction;
    this.y += this.vy;
  }

  isOutOfBounds(cameraX, screenWidth) {
    return this.x < cameraX - 100 || this.x > cameraX + screenWidth + 100;
  }

  draw(ctx) {
    if (!this.active) return;

    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;

    // 外发光
    ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
    ctx.fill();

    // 子弹主体
    ctx.fillStyle = '#FF4500';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();

    // 核心
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();

    // 尾焰
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
      ctx.fillStyle = '#000000';
      ctx.fillRect(this.x, this.y, this.width, this.height);

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
