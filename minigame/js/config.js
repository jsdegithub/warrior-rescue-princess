/**
 * 游戏资源配置
 * CDN: 腾讯云 COS + CDN
 */
import ENV from './env.js';

const CONFIG = {
  // 是否使用远程资源
  USE_CDN: false,

  // 是否使用 COS 资源
  USE_COS: true,

  // COS 基础地址（从本地环境配置读取）
  COS_BASE: ENV.COS_BASE,

  // CDN 基础地址（从本地环境配置读取）
  CDN_BASE: ENV.CDN_BASE,

  // 本地资源路径（作为降级方案）
  LOCAL_BASE: '',

  /**
   * 获取资源完整路径
   * @param {string} relativePath - 相对路径，如 'audio/bg.mp3'
   * @returns {string} 完整路径
   */
  getPath(relativePath) {
    // 优先使用 CDN 资源
    if (this.USE_CDN) {
      return `${this.CDN_BASE}/${relativePath}`;
    }
    // 其次使用 COS 资源
    if (this.USE_COS) {
      return `${this.COS_BASE}/${relativePath}`;
    }
    // 最后使用本地资源
    return `${this.LOCAL_BASE}${relativePath}`;
  },

  // 音频资源路径
  AUDIO: {
    jump: 'audio/jump.mp3',
    attack: 'audio/normal_attack.mp3',
    slashSword: 'audio/slash_sword.mp3',
    hurt: 'audio/harmed.mp3',
    dead: 'audio/dead.mp3',
    victory: 'audio/victory.mp3',
    running: 'audio/running.mp3',
    bgMusic: 'audio/bg.mp3',
    openingMusic: 'audio/opening_music.mp3',
    gameOverMusic: 'audio/love_cy.mp3',
  },

  // 图片资源路径
  IMAGES: {
    warriorAvatar: 'images/warrior.jpg',
    princessAvatar: 'images/princess.jpg',
    maleAdventurerBase: 'images/MaleAdventurer/',
    femaleAdventurerBase: 'images/FemaleAdventurer/',
  },
};

export default CONFIG;
