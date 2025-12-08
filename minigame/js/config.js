/**
 * 游戏资源配置
 * CDN: 腾讯云 COS + CDN
 */
const CONFIG = {
  // 是否使用远程资源
  USE_REMOTE: true,

  // CDN 基础地址
  CDN_BASE: 'https://qcsj.assets.aeeternity.com',

  // 本地资源路径（作为降级方案）
  LOCAL_BASE: '',

  /**
   * 获取资源完整路径
   * @param {string} relativePath - 相对路径，如 'audio/bg.mp3'
   * @returns {string} 完整路径
   */
  getPath(relativePath) {
    if (this.USE_REMOTE) {
      return `${this.CDN_BASE}/${relativePath}`;
    }
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

