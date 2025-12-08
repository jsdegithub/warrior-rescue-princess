/**
 * 音频管理器 - 微信小游戏版
 * 使用 CDN 远程资源
 */
import CONFIG from './config.js';

class SoundManager {
  constructor() {
    this.enabled = true;
    this.bgMusic = null;
    this.bgMusicVolume = 0.4;
    this.sfxVolume = 0.6;

    // 音效文件路径（使用 CDN）
    this.soundPaths = {
      jump: CONFIG.getPath(CONFIG.AUDIO.jump),
      attack: CONFIG.getPath(CONFIG.AUDIO.attack),
      slashSword: CONFIG.getPath(CONFIG.AUDIO.slashSword),
      hurt: CONFIG.getPath(CONFIG.AUDIO.hurt),
      dead: CONFIG.getPath(CONFIG.AUDIO.dead),
      victory: CONFIG.getPath(CONFIG.AUDIO.victory),
      running: CONFIG.getPath(CONFIG.AUDIO.running),
    };

    // 走路音效（需要循环播放）
    this.runningSound = null;
    this.isRunning = false;
  }

  // 播放音效文件
  playSoundFile(soundKey, volume = this.sfxVolume) {
    if (!this.enabled) return;

    const path = this.soundPaths[soundKey];
    if (!path) return;

    try {
      const audio = wx.createInnerAudioContext();
      audio.src = path;
      audio.volume = volume;
      audio.play();

      // 播放完成后销毁
      audio.onEnded(() => {
        audio.destroy();
      });

      audio.onError((err) => {
        console.log(`音效 ${soundKey} 播放出错:`, err);
        audio.destroy();
      });
    } catch (e) {
      console.log(`音效 ${soundKey} 播放失败:`, e);
    }
  }

  // 播放背景音乐（支持传入相对路径或完整路径）
  playBackgroundMusic(musicPath, loop = true) {
    // 先停止之前的背景音乐
    this.stopBackgroundMusic();

    if (!this.enabled) return;

    // 如果是相对路径，转换为 CDN 路径
    let fullPath = musicPath;
    if (!musicPath.startsWith('http')) {
      fullPath = CONFIG.getPath(musicPath);
    }

    try {
      this.bgMusic = wx.createInnerAudioContext();
      this.bgMusic.src = fullPath;
      this.bgMusic.loop = loop;
      this.bgMusic.volume = this.bgMusicVolume;

      this.bgMusic.onCanplay(() => {
        this.bgMusic.play();
      });

      this.bgMusic.onPlay(() => {
        console.log('背景音乐开始播放:', fullPath);
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

  // 跳跃音效
  jump() {
    this.playSoundFile('jump', 0.5);
  }

  // 普通攻击音效
  attack() {
    this.playSoundFile('attack', 0.5);
  }

  // 挥剑攻击音效（有大宝剑时）
  slashSword() {
    this.playSoundFile('slashSword', 0.6);
  }

  // 受伤音效
  hurt() {
    this.playSoundFile('hurt', 0.6);
  }

  // 死亡音效
  defeat() {
    this.playSoundFile('dead', 0.7);
  }

  // 胜利音效
  victory() {
    this.playSoundFile('victory', 0.8);
  }

  // 开始走路音效（循环）
  startRunning() {
    if (!this.enabled || this.isRunning) return;

    try {
      this.runningSound = wx.createInnerAudioContext();
      this.runningSound.src = this.soundPaths.running;
      this.runningSound.loop = true;
      this.runningSound.volume = 0.3;
      this.runningSound.play();
      this.isRunning = true;
    } catch (e) {
      console.log('走路音效播放失败:', e);
    }
  }

  // 停止走路音效
  stopRunning() {
    if (this.runningSound) {
      this.runningSound.stop();
      this.runningSound.destroy();
      this.runningSound = null;
    }
    this.isRunning = false;
  }
}

export default SoundManager;
