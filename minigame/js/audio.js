/**
 * 音频管理器 - 微信小游戏版
 */
class SoundManager {
  constructor() {
    this.enabled = true;
    this.bgMusic = null;
    this.bgMusicVolume = 0.4;
    this.audioContext = null;
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      // 微信小游戏的 WebAudio API
      this.audioContext = wx.createWebAudioContext();
    } catch (e) {
      console.log('WebAudio API not supported:', e);
    }
  }

  // 播放背景音乐
  playBackgroundMusic(musicPath) {
    if (!this.enabled) return;

    try {
      this.bgMusic = wx.createInnerAudioContext();
      this.bgMusic.src = musicPath;
      this.bgMusic.loop = true;
      this.bgMusic.volume = this.bgMusicVolume;
      this.bgMusic.autoplay = true;

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

  // 播放音效
  playSound(frequency, duration, type = 'sine') {
    if (!this.enabled || !this.audioContext) return;

    try {
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
    } catch (e) {
      // 忽略音效播放错误
    }
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

export default SoundManager;

