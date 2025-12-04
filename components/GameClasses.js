// 音效系统
export class SoundManager {
	constructor() {
		this.enabled = true;
		this.audioContext = null;
		this.initAudioContext();
	}

	initAudioContext() {
		try {
			this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
		} catch (e) {
			console.log('Web Audio API not supported');
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
		this.width = 60;
		this.height = 80;
		this.image = image;
		this.imagePath = imagePath;
		this.soundManager = soundManager;
		this.sprites = sprites;

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

		this.direction = 1;
		this.walkFrame = 0;
		this.walkTime = 0;
		this.attackFrame = 0;
	}

	update(deltaTime, input, platforms, traps) {
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

		this.checkTraps(traps);

		this.onGround = false;
		platforms.forEach((platform) => {
			if (this.checkPlatformCollision(platform)) {
				this.handlePlatformCollision(platform);
			}
		});

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
				if (this.x + this.width > trap.x && this.x < trap.x + trap.width && this.y + this.height > trap.y) {
					this.health = 0;
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

	handlePlatformCollision(platform) {
		const prevY = this.y - this.vy;

		if (prevY + this.height <= platform.y && this.vy > 0) {
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

		if (this.direction === -1) {
			ctx.translate(this.x + this.width, 0);
			ctx.scale(-1, 1);
			ctx.translate(-this.x, 0);
		}

		// 绘制勇士身体（简单矩形）
		ctx.fillStyle = '#4169E1'; // 蓝色
		ctx.fillRect(this.x, this.y + 25, this.width, this.height - 25);

		// 绘制头部（圆形照片）
		const headCenterX = this.x + this.width / 2;
		const headCenterY = this.y + 15;
		const headRadius = 15;

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
				ctx.fillRect(
					headCenterX - headRadius,
					headCenterY - headRadius,
					headRadius * 2,
					headRadius * 2
				);
			}
		} else {
			// 默认头部
			ctx.fillStyle = '#FFE4B5';
			ctx.fillRect(
				headCenterX - headRadius,
				headCenterY - headRadius,
				headRadius * 2,
				headRadius * 2
			);
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

// 公主类
export class Princess {
	constructor(x, y, image, imagePath) {
		this.x = x;
		this.y = y;
		this.width = 60;
		this.height = 80;
		this.image = image;
		this.imagePath = imagePath;
	}

	drawPixel(ctx, x, y, size, color) {
		ctx.fillStyle = color;
		ctx.fillRect(x, y, size, size);
	}

	draw(ctx) {
		ctx.save();
		ctx.imageSmoothingEnabled = false;

		const pixelSize = 4;
		const baseX = this.x;
		const baseY = this.y;

		const skinColor = '#FFE4B5';
		const dressColor = '#FF69B4';
		const dressLight = '#FFB6C1';
		const crownColor = '#FFD700';

		const dressPixels = [
			[4, 7], [5, 7], [6, 7], [7, 7], [8, 7],
			[4, 8], [5, 8], [6, 8], [7, 8], [8, 8],
			[4, 9], [5, 9], [6, 9], [7, 9], [8, 9],
			[3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10],
			[2, 11], [3, 11], [4, 11], [5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11],
			[2, 12], [3, 12], [4, 12], [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12],
			[2, 13], [3, 13], [4, 13], [5, 13], [6, 13], [7, 13], [8, 13], [9, 13], [10, 13],
			[2, 14], [3, 14], [4, 14], [5, 14], [6, 14], [7, 14], [8, 14], [9, 14], [10, 14],
			[3, 15], [4, 15], [5, 15], [6, 15], [7, 15], [8, 15], [9, 15],
		];
		dressPixels.forEach(([px, py]) => {
			this.drawPixel(ctx, baseX + px * pixelSize, baseY + py * pixelSize, pixelSize, dressColor);
		});

		const dressDecor = [
			[3, 13], [5, 13], [7, 13], [9, 13],
			[4, 14], [6, 14], [8, 14],
		];
		dressDecor.forEach(([px, py]) => {
			this.drawPixel(ctx, baseX + px * pixelSize, baseY + py * pixelSize, pixelSize, dressLight);
		});

		const armPixels = [
			[2, 8], [2, 9], [2, 10],
			[10, 8], [10, 9], [10, 10],
		];
		armPixels.forEach(([px, py]) => {
			this.drawPixel(ctx, baseX + px * pixelSize, baseY + py * pixelSize, pixelSize, dressColor);
		});

		const handPixels = [
			[1, 10], [1, 11],
			[11, 10], [11, 11],
		];
		handPixels.forEach(([px, py]) => {
			this.drawPixel(ctx, baseX + px * pixelSize, baseY + py * pixelSize, pixelSize, skinColor);
		});

		// 绘制头部（圆形照片）
		const headCenterX = baseX + 6 * pixelSize;
		const headCenterY = baseY + 4 * pixelSize;
		const headRadius = 10;

		ctx.save();
		ctx.beginPath();
		ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
		ctx.closePath();
		ctx.clip();

		// 尝试绘制公主照片
		if (this.imagePath && typeof ctx.drawImage === 'function') {
			try {
				ctx.drawImage(
					this.imagePath,
					headCenterX - headRadius,
					headCenterY - headRadius,
					headRadius * 2,
					headRadius * 2
				);
			} catch (e) {
				// 如果失败，使用像素绘制默认头部
				const headPixels = [
					[4, 2], [5, 2], [6, 2], [7, 2],
					[3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3],
					[3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4],
					[3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5],
					[4, 6], [5, 6], [6, 6], [7, 6],
				];
				headPixels.forEach(([px, py]) => {
					this.drawPixel(ctx, baseX + px * pixelSize, baseY + py * pixelSize, pixelSize, skinColor);
				});
			}
		} else {
			// 默认像素头部
			const headPixels = [
				[4, 2], [5, 2], [6, 2], [7, 2],
				[3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3],
				[3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4],
				[3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5],
				[4, 6], [5, 6], [6, 6], [7, 6],
			];
			headPixels.forEach(([px, py]) => {
				this.drawPixel(ctx, baseX + px * pixelSize, baseY + py * pixelSize, pixelSize, skinColor);
			});
		}
		ctx.restore();

		const crownPixels = [
			[4, 0], [5, 0], [6, 0], [7, 0], [8, 0],
			[4, 1], [5, 1], [6, 1], [7, 1], [8, 1],
			[3, 1], [9, 1],
			[5, -1], [7, -1],
		];
		crownPixels.forEach(([px, py]) => {
			this.drawPixel(ctx, baseX + px * pixelSize, baseY + (py + 2) * pixelSize, pixelSize, crownColor);
		});

		this.drawPixel(ctx, baseX + 6 * pixelSize, baseY + 2 * pixelSize, pixelSize, '#FF1493');

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
		this.vx = type === 'fly' ? 2 : 1;
		this.vy = 0;
		this.defeated = false;
		this.direction = 1;

		if (type === 'fly') {
			this.flyTime = 0;
			this.flyAmplitude = 50;
			this.startY = y;
		}
	}

	update(deltaTime) {
		if (this.defeated) return;

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
		}
	}

	defeat() {
		this.defeated = true;
	}

	draw(ctx) {
		if (this.defeated) return;

		ctx.fillStyle = '#8B0000';

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

			const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
			gradient.addColorStop(0, '#333333');
			gradient.addColorStop(1, '#000000');
			ctx.fillStyle = gradient;
			ctx.fillRect(this.x, this.y, this.width, this.height);
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
