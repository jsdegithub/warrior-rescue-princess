<template>
  <view class="container">
    <view class="menu-screen">
      <view class="title">勇士救公主</view>
      <view class="subtitle">Warrior Rescue Princess</view>

      <view class="menu-buttons">
        <button class="menu-btn start-btn" @click="startGame">开始游戏</button>
        <button class="menu-btn help-btn" @click="showHelp">游戏说明</button>
        <button class="menu-btn sound-btn" @click="toggleSound">音效: {{ soundEnabled ? '开' : '关' }}</button>
      </view>
    </view>

    <!-- 帮助界面 -->
    <view v-if="showHelpScreen" class="help-screen">
      <view class="help-content">
        <view class="help-title">游戏说明</view>

        <view class="help-section">
          <view class="help-section-title">🎯 游戏目标</view>
          <text>控制勇士从左侧出发，穿越重重关卡，到达右侧与公主相拥即可通关</text>
        </view>

        <view class="help-section">
          <view class="help-section-title">🎮 PC端控制</view>
          <text>← → 或 A/D: 左右移动</text>
          <text>空格键: 跳跃</text>
          <text>J 键: 攻击</text>
        </view>

        <view class="help-section">
          <view class="help-section-title">📱 移动端控制</view>
          <text>使用屏幕下方的虚拟按钮控制</text>
        </view>

        <view class="help-section">
          <view class="help-section-title">⚠️ 注意事项</view>
          <text>❤️ 生命值: 3颗心</text>
          <text>🏔️ 避开尖刺和深坑</text>
          <text>👹 击败敌人或跳跃踩踏</text>
        </view>

        <button class="menu-btn back-btn" @click="hideHelp">返回</button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      soundEnabled: true,
      showHelpScreen: false,
    };
  },
  methods: {
    startGame() {
      uni.navigateTo({
        url: '/pages/game/game',
      });
    },
    showHelp() {
      this.showHelpScreen = true;
    },
    hideHelp() {
      this.showHelpScreen = false;
    },
    toggleSound() {
      this.soundEnabled = !this.soundEnabled;
      uni.setStorageSync('soundEnabled', this.soundEnabled);
    },
  },
  onLoad() {
    const soundEnabled = uni.getStorageSync('soundEnabled');
    if (soundEnabled !== undefined && soundEnabled !== null) {
      this.soundEnabled = soundEnabled;
    }
  },
};
</script>

<style scoped>
.container {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.menu-screen {
  text-align: center;
  color: white;
}

.title {
  font-size: 60px;
  font-weight: bold;
  margin-bottom: 10px;
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.3);
  animation: titleFloat 3s ease-in-out infinite;
}

.subtitle {
  font-size: 24px;
  margin-bottom: 50px;
  opacity: 0.9;
}

@keyframes titleFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.menu-buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  margin-bottom: 40px;
}

.menu-btn {
  width: 250px;
  padding: 15px 30px;
  font-size: 20px;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  font-weight: bold;
}

.start-btn {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.help-btn {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.sound-btn {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: white;
}

.menu-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.game-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 16px;
  opacity: 0.8;
}

.help-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.help-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40px;
  border-radius: 20px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  color: white;
}

.help-title {
  font-size: 36px;
  font-weight: bold;
  margin-bottom: 30px;
  text-align: center;
}

.help-section {
  margin-bottom: 25px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.help-section-title {
  font-size: 22px;
  font-weight: bold;
  margin-bottom: 10px;
  color: #ffd700;
}

.help-section text {
  font-size: 16px;
  line-height: 1.6;
  padding-left: 10px;
}

.back-btn {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: white;
  margin-top: 20px;
  width: 100%;
}
</style>
